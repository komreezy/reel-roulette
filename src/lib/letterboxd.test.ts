import { afterEach, describe, expect, it, vi } from "vitest";
import { getDiary, getList, getWatchlist, parseDiaryPage, parseWatchlistPage, validatePublicListUrl, validatePublicUsername } from "./letterboxd";
import { GET } from "../app/api/letterboxd/watchlist/route";
import { GET as GET_DIARY } from "../app/api/letterboxd/diary/route";
import { GET as GET_LIST } from "../app/api/letterboxd/list/route";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

const page = (body: string, status = 200) => new Response(body, { status, headers: { "content-type": "text/html" } });

describe("Letterboxd watchlist adapter", () => {
  it("accepts only a public username segment", () => {
    expect(validatePublicUsername("film_fan-7")).toBe("film_fan-7");
    expect(() => validatePublicUsername("../admin")).toThrow();
    expect(() => validatePublicUsername("https://evil.example/user")).toThrow();
    expect(() => validatePublicUsername("user name")).toThrow();
  });

  it("parses live-shaped LazyPoster attributes, decodes entities, extracts the trailing year, and dedupes canonical film URLs", () => {
    const html = `
      <div class="react-component" data-component-class="LazyPoster" data-item-name="L&eacute;on: The Professional (1994)" data-item-slug="leon-the-professional" data-item-link="/film/leon-the-professional/"></div>
      <div class="react-component" data-component-class="LazyPoster" data-item-name="L&eacute;on: The Professional (1994)" data-item-slug="leon-the-professional" data-item-link="/film/leon-the-professional/"></div>
      <div class="react-component" data-component-class="LazyPoster" data-item-name="No Year" data-item-slug="no-year" data-item-link="/film/no-year/"></div>`;
    expect(parseWatchlistPage(html)).toEqual([
      { id: "letterboxd-leon-the-professional", title: "Léon: The Professional", year: 1994, externalUrl: "https://letterboxd.com/film/leon-the-professional/" },
      { id: "letterboxd-no-year", title: "No Year", externalUrl: "https://letterboxd.com/film/no-year/" },
    ]);
  });

  it("decodes standard named HTML entities in film titles", () => {
    const html = '<div class="LazyPoster" data-item-name="L&Ouml;ve &hellip; Again (2024)" data-item-slug="love-again" data-item-link="/film/love-again/"></div>';
    expect(parseWatchlistPage(html)[0].title).toBe("LÖve … Again");
  });

  it("follows explicit older-page links with a fixed safe request policy", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      expect(url).toMatch(/^https:\/\/letterboxd\.com\/film_fan-7\/watchlist\/page\/[12]\/$/);
      expect(new Headers(init?.headers).get("user-agent")).toContain("Reel Roulette");
      expect(new Headers(init?.headers).get("accept")).toContain("text/html");
      expect(new Headers(init?.headers).get("cookie")).toBeNull();
      expect(new Headers(init?.headers).get("authorization")).toBeNull();
      expect(init?.redirect).toBe("error");
      return url.endsWith("/page/1/")
        ? page('<div class="LazyPoster" data-item-name="One (2020)" data-item-slug="one" data-item-link="/film/one/"></div><a class="next" href="/film_fan-7/watchlist/page/2/">Older</a>')
        : page('<div class="LazyPoster" data-item-name="Two (2021)" data-item-slug="two" data-item-link="/film/two/"></div>');
    });
    await expect(getWatchlist("film_fan-7")).resolves.toMatchObject({ films: [
      expect.objectContaining({ title: "One", source: "letterboxd", watched: false, genres: [], externalUrl: "https://letterboxd.com/film/one/" }),
      expect.objectContaining({ title: "Two", externalUrl: "https://letterboxd.com/film/two/" }),
    ] });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("stops pagination when the total import deadline is exhausted", async () => {
    let now = 0;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      now = 30_001;
      return page('<div class="LazyPoster" data-item-name="One (2020)" data-item-slug="one" data-item-link="/film/one/"></div><a class="next" href="/film-fan/watchlist/page/2/">Older</a>');
    });
    await expect(getWatchlist("film-fan")).rejects.toThrow("import took too long");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("fails instead of returning a partial pool at the page limit", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
      const currentPage = Number(String(input).match(/\/page\/(\d+)\/$/)?.[1]);
      return page(`<div class="LazyPoster" data-item-name="One (2020)" data-item-slug="one" data-item-link="/film/one/"></div><a class="next" href="/film-fan/watchlist/page/${currentPage + 1}/">Older</a>`);
    });
    await expect(getWatchlist("film-fan")).rejects.toThrow("too many pages");
    expect(fetcher).toHaveBeenCalledTimes(100);
  });

  it("rejects repeated pagination instead of wasting the import budget", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async () => page('<div class="LazyPoster" data-item-name="One (2020)" data-item-slug="one" data-item-link="/film/one/"></div><a class="next" href="/film-fan/watchlist/page/1/">Older</a>'));
    await expect(getWatchlist("film-fan")).rejects.toThrow("invalid pagination");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects a next link that escapes the validated collection path", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(page('<div class="LazyPoster" data-item-name="One (2020)" data-item-slug="one" data-item-link="/film/one/"></div><a class="next" href="/other-user/watchlist/page/2/">Older</a>'));
    await expect(getWatchlist("film-fan")).rejects.toThrow("invalid pagination");
  });

  it("clears request deadlines after a successful page", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(page('<div class="LazyPoster" data-item-name="One (2020)" data-item-slug="one" data-item-link="/film/one/"></div>'));
    await getWatchlist("film-fan");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops reading an oversized streaming response as soon as the byte cap is crossed", async () => {
    let reads = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        reads += 1;
        if (reads === 1) controller.enqueue(new Uint8Array(1_500_000));
        else if (reads === 2) controller.enqueue(new Uint8Array(600_001));
        else { controller.enqueue(new Uint8Array(1)); controller.close(); }
      },
    }, { highWaterMark: 0 });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(body, { status: 200, headers: { "content-type": "text/html" } }));
    await expect(getWatchlist("film-fan")).rejects.toThrow("unexpectedly large page");
    expect(reads).toBe(2);
  });

  it("rejects non-success responses and oversized pages", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(page("not found", 404));
    await expect(getWatchlist("missing-user")).rejects.toMatchObject({ code: "not_found" });
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(page("x".repeat(2_000_001)));
    await expect(getWatchlist("big-page")).rejects.toMatchObject({ code: "upstream" });
  });

  it("returns honest API status codes for missing and invalid usernames", async () => {
    expect((await GET(new Request("http://localhost/api/letterboxd/watchlist"))).status).toBe(400);
    expect((await GET(new Request("http://localhost/api/letterboxd/watchlist?username=../admin"))).status).toBe(400);
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(page("missing", 404));
    expect((await GET(new Request("http://localhost/api/letterboxd/watchlist?username=missing-user"))).status).toBe(404);
  });
});

describe("Letterboxd diary adapter", () => {
  it("parses diary LazyPoster rows as watched films and dedupes canonical URLs", () => {
    const html = `
      <div class="react-component" data-component-class="LazyPoster" data-item-name="Past Lives (2023)" data-item-slug="past-lives" data-item-link="/film/past-lives/"></div>
      <div class="react-component" data-component-class="LazyPoster" data-item-name="Past Lives (2023)" data-item-slug="past-lives" data-item-link="/film/past-lives/"></div>`;
    expect(parseDiaryPage(html)).toEqual([
      { id: "letterboxd-past-lives", title: "Past Lives", year: 2023, externalUrl: "https://letterboxd.com/film/past-lives/", watched: true },
    ]);
  });

  it("follows only exact same-user diary next links and maps every film as watched", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      expect(url).toMatch(/^https:\/\/letterboxd\.com\/film_fan-7\/diary\/films\/page\/[12]\/$/);
      expect(new Headers(init?.headers).get("user-agent")).toContain("Reel Roulette");
      expect(new Headers(init?.headers).get("cookie")).toBeNull();
      expect(new Headers(init?.headers).get("authorization")).toBeNull();
      expect(init?.redirect).toBe("error");
      return url.endsWith("/page/1/")
        ? page('<div class="react-component" data-component-class="LazyPoster" data-item-name="One (2020)" data-item-slug="one" data-item-link="/film/one/"><a class="next" href="/film_fan-7/diary/films/page/2/"></a><a class="next" href="/other/diary/films/page/2/"></a>')
        : page('<div class="react-component" data-component-class="LazyPoster" data-item-name="Two (2021)" data-item-slug="two" data-item-link="/film/two/"></div>');
    });
    await expect(getDiary("film_fan-7")).resolves.toMatchObject({ films: [
      expect.objectContaining({ title: "One", watched: true, externalUrl: "https://letterboxd.com/film/one/" }),
      expect.objectContaining({ title: "Two", watched: true, externalUrl: "https://letterboxd.com/film/two/" }),
    ] });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("returns honest diary API statuses and no-store responses", async () => {
    expect((await GET_DIARY(new Request("http://localhost/api/letterboxd/diary"))).status).toBe(400);
    expect((await GET_DIARY(new Request("http://localhost/api/letterboxd/diary?username=../admin"))).status).toBe(400);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(page("missing", 404));
    const missing = await GET_DIARY(new Request("http://localhost/api/letterboxd/diary?username=missing-user"));
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({ error: "That public Letterboxd page was not found." });
    expect(missing.headers.get("cache-control")).toBe("no-store");
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    expect((await GET_DIARY(new Request("http://localhost/api/letterboxd/diary?username=offline-user"))).status).toBe(502);
  });
});

describe("Letterboxd curated list adapter", () => {
  it("accepts only canonical public Letterboxd list URLs", () => {
    expect(validatePublicListUrl("https://letterboxd.com/film_fan-7/list/weekend-picks/"))
      .toBe("https://letterboxd.com/film_fan-7/list/weekend-picks/");
    expect(validatePublicListUrl("https://letterboxd.com/film_fan-7/list/weekend-picks"))
      .toBe("https://letterboxd.com/film_fan-7/list/weekend-picks/");
    expect(() => validatePublicListUrl("http://letterboxd.com/film_fan-7/list/weekend-picks/")).toThrow();
    expect(() => validatePublicListUrl("https://letterboxd.com.evil.example/film_fan-7/list/weekend-picks/")).toThrow();
    expect(() => validatePublicListUrl("https://letterboxd.com/film_fan-7/watchlist/")).toThrow();
    expect(() => validatePublicListUrl("https://letterboxd.com/film_fan-7/list/weekend-picks/?sort=popular")).toThrow();
  });

  it("imports every page from the exact validated public list path", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      expect(init?.redirect).toBe("error");
      if (url === "https://letterboxd.com/film_fan-7/list/weekend-picks/") {
        return page('<div class="LazyPoster" data-item-name="One (2020)" data-item-slug="one" data-item-link="/film/one/"></div><a class="next" href="/film_fan-7/list/weekend-picks/page/2/">Older</a>');
      }
      expect(url).toBe("https://letterboxd.com/film_fan-7/list/weekend-picks/page/2/");
      return page('<div class="LazyPoster" data-item-name="Two (2021)" data-item-slug="two" data-item-link="/film/two/"></div>');
    });
    await expect(getList("https://letterboxd.com/film_fan-7/list/weekend-picks/"))
      .resolves.toMatchObject({ films: [
        expect.objectContaining({ title: "One", watched: false }),
        expect.objectContaining({ title: "Two", watched: false }),
      ] });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("returns honest list API statuses and no-store responses", async () => {
    expect((await GET_LIST(new Request("http://localhost/api/letterboxd/list"))).status).toBe(400);
    expect((await GET_LIST(new Request("http://localhost/api/letterboxd/list?url=https%3A%2F%2Fevil.example%2Fx%2Flist%2Fy%2F"))).status).toBe(400);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(page("missing", 404));
    const missing = await GET_LIST(new Request("http://localhost/api/letterboxd/list?url=https%3A%2F%2Fletterboxd.com%2Ffilm-fan%2Flist%2Fmissing%2F"));
    expect(missing.status).toBe(404);
    expect(missing.headers.get("cache-control")).toBe("no-store");
  });
});
