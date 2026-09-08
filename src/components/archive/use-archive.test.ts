// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useArchive } from "./use-archive";

function response(films: unknown[], ok = true) {
  return {
    ok,
    json: async () => (ok ? { films } : { error: "Could not open that list." }),
  } as Response;
}

const importedFilm = {
  id: "new-film",
  title: "A new film",
  genres: [],
  watched: false,
  externalUrl: "https://letterboxd.com/film/new-film/",
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(globalThis.crypto, "getRandomValues").mockImplementation((array) => {
    if (array instanceof Uint32Array) array.fill(0);
    return array;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("archive controller", () => {
  it("reveals idempotently and ignores fast repeat clicks", () => {
    const { result } = renderHook(() => useArchive());
    act(() => result.current.useDemo());
    act(() => {
      result.current.pullMovie();
      result.current.pullMovie();
    });
    expect(result.current.pulling).toBe(true);
    expect(result.current.drawCount).toBe(0);
    expect(result.current.winner).toBeNull();
    const serial = result.current.pull!.serial;
    act(() => {
      result.current.reveal(serial);
      result.current.reveal(serial);
    });
    expect(result.current.drawCount).toBe(1);
    expect(result.current.remaining).toBe(7);
    expect(result.current.winner?.title).toBe("Arrival");
    act(() => result.current.pullMovie());
    expect(result.current.pull?.movie.title).toBe("Moonlight");
  });

  it("finishes a result even if the animation never calls back", () => {
    const { result } = renderHook(() => useArchive());
    act(() => {
      result.current.useDemo();
      result.current.pullMovie();
    });
    act(() => vi.advanceTimersByTime(3_499));
    expect(result.current.pulling).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.pulling).toBe(false);
    expect(result.current.winner?.title).toBe("Arrival");
  });

  it("invalidates pending results on reset, including delayed animation callbacks", () => {
    const { result } = renderHook(() => useArchive());
    act(() => {
      result.current.useDemo();
      result.current.pullMovie();
    });
    const oldSerial = result.current.pull!.serial;
    act(() => result.current.reset());
    act(() => {
      result.current.reveal(oldSerial);
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current.winner).toBeNull();
    expect(result.current.movies).toHaveLength(0);
    expect(result.current.drawCount).toBe(0);
    act(() => {
      result.current.useDemo();
      result.current.pullMovie();
    });
    act(() => result.current.reveal(oldSerial));
    expect(result.current.pulling).toBe(true);
  });

  it("ignores a stale import when the visible source input changes", async () => {
    let finish!: (value: Response) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useArchive());
    act(() => result.current.useDemo());
    let loading!: Promise<void>;
    act(() => {
      loading = result.current.importSource("watchlist", "first-user");
    });
    expect(result.current.loading).toBe(true);
    const signal = (
      fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    )[1].signal;
    act(() => result.current.cancelImport());
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      finish(response([importedFilm]));
      await loading;
    });
    expect(result.current.sourceKind).toBe("demo");
    expect(result.current.movies).toHaveLength(8);
    expect(result.current.loading).toBe(false);
  });

  it("keeps a current collection if its replacement fails and does not consume canceled pulls", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response([], false)));
    const { result } = renderHook(() => useArchive());
    act(() => {
      result.current.useDemo();
      result.current.pullMovie();
    });
    act(() => result.current.reveal(result.current.pull!.serial));
    act(() => result.current.pullMovie());
    const canceledSerial = result.current.pull!.serial;
    expect(result.current.pull?.movie.title).toBe("Moonlight");
    await act(async () =>
      result.current.importSource(
        "list",
        "https://letterboxd.com/user/list/missing/",
      ),
    );
    act(() => result.current.reveal(canceledSerial));
    expect(result.current.movies).toHaveLength(8);
    expect(result.current.error).toBe("Could not open that list.");
    expect(result.current.drawCount).toBe(1);
    act(() => result.current.pullMovie());
    expect(result.current.pull?.movie.title).toBe("Moonlight");
  });

  it("imports through the existing no-store API and normalizes source duplicates", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        response([
          importedFilm,
          {
            ...importedFilm,
            id: "same-film",
            externalUrl: "https://letterboxd.com/film/new-film?from=list",
          },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useArchive());
    await act(async () =>
      result.current.importSource("watchlist", " @film_fan-7 "),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/letterboxd/watchlist?username=film_fan-7",
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(result.current.movies).toHaveLength(1);
    expect(result.current.sourceKind).toBe("watchlist");
    expect(result.current.remaining).toBe(1);
    expect(result.current.error).toBeNull();
  });

  it("restarts silently after every result and handles an empty imported collection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response([])));
    const { result } = renderHook(() => useArchive());
    act(() => result.current.useDemo());
    const titles: string[] = [];
    for (let index = 0; index < 9; index += 1) {
      act(() => result.current.pullMovie());
      act(() => result.current.reveal(result.current.pull!.serial));
      titles.push(result.current.winner!.title);
    }
    expect(new Set(titles.slice(0, 8)).size).toBe(8);
    expect(titles[8]).not.toBe(titles[7]);
    expect(result.current.notice).toBe("Selected Arrival.");
    await act(async () => result.current.importSource("watchlist", "empty"));
    act(() => result.current.pullMovie());
    expect(result.current.movies).toHaveLength(0);
    expect(result.current.pull).toBeNull();
    expect(result.current.notice).toContain("empty");
  });
});
