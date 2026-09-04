import { afterEach, describe, expect, it, vi } from "vitest";
import { getLibraries, getMovies, getResources, resolveServer } from "./plex";

afterEach(() => vi.restoreAllMocks());
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
describe("Plex adapter contracts", () => {
  it("parses the top-level array returned by the Plex resources API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json([{ clientIdentifier: "machine-1", name: "Home", product: "Plex Media Server", accessToken: "server-token", connections: [{ uri: "https://server.plex.direct:32400", local: false, relay: false }] }]));
    const resources = await getResources("account-token", "client-1");
    expect(resources).toHaveLength(1);
    expect(resources[0]).toMatchObject({ id: "machine-1", name: "Home", accessToken: "server-token" });
  });
  it("uses the resource token and keeps only remotely reachable server data", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ MediaContainer: { Device: [{ clientIdentifier: "machine-1", name: "Shared", product: "Plex Media Server", accessToken: "server-token", Connection: [{ uri: "https://relay", relay: true }] }] } }));
    const resources = await getResources("account-token", "client-1"); expect(resources[0].accessToken).toBe("server-token"); expect(fetcher.mock.calls[0][0]).toContain("includeIPv6=1");
  });
  it("never substitutes the account token for a missing resource token", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ MediaContainer: { Device: [{ clientIdentifier: "machine-1", name: "Unsafe", product: "Plex Media Server", Connection: [{ uri: "https://server.plex.direct:32400", relay: false }] }] } }));
    expect(await getResources("account-token", "client-1")).toEqual([]);
  });
  it("falls back from an unreachable direct connection to Plex Relay", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
      const url = String(input);
      if (url.startsWith("https://clients.plex.tv/api/v2/resources")) return json([{ clientIdentifier: "machine-1", name: "Home", product: "Plex Media Server", accessToken: "server-token", connections: [{ uri: "https://direct.plex.direct:32400", local: false, relay: false }, { uri: "https://relay.plex.tv:443/machine-1", local: false, relay: true }] }]);
      if (url.startsWith("https://direct.plex.direct")) return json({}, 401);
      return json({ MediaContainer: {} });
    });
    await expect(resolveServer("account-token", "client-1", "machine-1")).resolves.toMatchObject({ uri: "https://relay.plex.tv:443/machine-1" });
  });
  it("uses the Plex JWT when a resource token is rejected by PMS", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.startsWith("https://clients.plex.tv/api/v2/resources")) return json([{ clientIdentifier: "machine-1", name: "Home", product: "Plex Media Server", accessToken: "resource-token", connections: [{ uri: "https://direct.plex.direct:32400", local: false, relay: false }] }]);
      const requestToken = new Headers(init?.headers).get("X-Plex-Token");
      return json({}, requestToken === "account-token" ? 200 : 401);
    });
    await expect(resolveServer("account-token", "client-1", "machine-1")).resolves.toMatchObject({ token: "account-token", uri: "https://direct.plex.direct:32400" });
  });
  it("falls back to sections/all only for a 404 and paginates until total", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => { const url = String(input); if (url.endsWith("/library/sections")) return json({}, 404); if (url.endsWith("/library/sections/all")) return json({ MediaContainer: { Directory: [{ key: 7, type: "movie", title: "Films" }] } }); const start = new URL(url).searchParams; return json({ MediaContainer: { offset: Number(start.get("x") ?? 0), totalSize: 2, Video: [{ ratingKey: String(start.get("page") ?? "1"), title: "Film", year: "2024", duration: 600000 }] } }); });
    const connection = { uri: "https://server", token: "server-token" }; expect((await getLibraries(connection, "client-1"))[0].key).toBe("7");
    fetcher.mockReset().mockImplementation(async (_input, init) => { const headers = new Headers(init?.headers); const start = Number(headers.get("X-Plex-Container-Start") ?? 0); return json({ MediaContainer: { totalSize: 2, Video: start === 0 ? [{ ratingKey: 1, title: "One", duration: "600000" }] : [{ ratingKey: "2", title: "Two", duration: 600000 }] } }); });
    const movies = await getMovies(connection, "7", "client-1"); expect(movies).toHaveLength(2); expect(movies[0].year).toBeUndefined(); expect(fetcher.mock.calls).toHaveLength(2);
  });
});
