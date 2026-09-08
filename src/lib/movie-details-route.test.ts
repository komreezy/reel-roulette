import { afterEach, expect, it, vi } from "vitest";
import { GET } from "@/app/api/movies/details/route";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("rejects invalid input before calling upstream", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  expect((await GET(new Request("https://example.com/api/movies/details?title=Arrival&year=oops"))).status).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
});
it("returns only matched movie details and keeps the token in the server request", async () => {
  vi.stubEnv("TMDB_API_READ_TOKEN", "test-private-token");
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ results: [{ id: 329865, title: "Arrival", release_date: "2016-11-10" }] })).mockResolvedValueOnce(Response.json({ poster_path: "/poster.jpg", runtime: 116, overview: "A linguist makes contact.", genres: [{ name: "Science Fiction" }], credits: { crew: [{ job: "Director", name: "Denis Villeneuve" }] } }));
  vi.stubGlobal("fetch", fetcher);
  const response = await GET(new Request("https://example.com/api/movies/details?title=Arrival&year=2016"));
  const body = await response.json();
  expect(body.details).toMatchObject({ tmdbId: 329865, directors: ["Denis Villeneuve"], runtimeMinutes: 116, posterUrl: "https://image.tmdb.org/t/p/w500/poster.jpg" });
  expect(JSON.stringify(body)).not.toContain("test-private-token");
  expect(fetcher.mock.calls[0][1].headers.Authorization).toBe("Bearer test-private-token");
});
it("fails gracefully on upstream errors", async () => {
  vi.stubEnv("TMDB_API_READ_TOKEN", "test");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  const response = await GET(new Request("https://example.com/api/movies/details?title=Arrival"));
  expect(response.status).toBe(502);
  expect(await response.json()).toEqual({ details: null });
});
it("resolves ambiguous movies using the canonical Letterboxd identifier", async () => {
  vi.stubEnv("TMDB_API_READ_TOKEN", "test");
  const fetcher = vi.fn()
    .mockResolvedValueOnce(Response.json({ results: [] }))
    .mockResolvedValueOnce(new Response('<body data-tmdb-id="329865">'))
    .mockResolvedValueOnce(Response.json({ runtime: 116 }));
  vi.stubGlobal("fetch", fetcher);
  const response = await GET(new Request("https://example.com/api/movies/details?title=Arrival&year=2016&film=https%3A%2F%2Fletterboxd.com%2Ffilm%2Farrival-2016%2F"));
  expect((await response.json()).details.tmdbId).toBe(329865);
  expect(fetcher.mock.calls[1][0]).toBe("https://letterboxd.com/film/arrival-2016/");
});
it("does not fetch arbitrary film URLs", async () => {
  vi.stubEnv("TMDB_API_READ_TOKEN", "test");
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ results: [] }));
  vi.stubGlobal("fetch", fetcher);
  await GET(new Request("https://example.com/api/movies/details?title=Arrival&film=http://127.0.0.1/private"));
  expect(fetcher).toHaveBeenCalledTimes(1);
});
