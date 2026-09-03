import { beforeEach, describe, expect, it } from "vitest";
import { seal, unseal, unsealPending, unsealSession } from "./session";
import { chooseConnection, isApprovedConnectionUri, parsePayload, readLimitedBytes, validateArtworkPath } from "./plex";

beforeEach(() => { process.env.SESSION_SECRET = "test secret that is long enough for aes gcm"; });
describe("sealed auth state", () => {
  it("round trips and rejects tampering", async () => { const value = await seal({ token: "secret", clientId: "client", expiresAt: Date.now() + 1000 }); expect(unsealSession(value)?.token).toBe("secret"); const altered = `${value.slice(0, -1)}${value.endsWith("a") ? "b" : "a"}`; expect(unseal(altered)).toBeNull(); });
  it("rejects expired sessions and pending state", async () => { const value = await seal({ token: "secret", clientId: "client", expiresAt: Date.now() - 1 }); expect(unsealSession(value)).toBeNull(); const pending = await seal({ id: 1, privateKey: "key", expiresAt: Date.now() - 1 }); expect(unsealPending(pending)).toBeNull(); });
});
describe("Plex payload and policy helpers", () => {
  it("parses JSON and XML-shaped payloads", () => { expect(parsePayload({ MediaContainer: { Directory: [{ key: 1 }] } }, "Directory")).toHaveLength(1); expect(parsePayload('<Directory key="1" title="Movies"/>', "Directory")[0].title).toBe("Movies"); });
  it("prefers approved remote direct HTTPS, then relay", () => { expect(chooseConnection({ rawConnections: [{ uri: "https://relay.plex.services", relay: true }, { uri: "https://local.plex.direct:32400", local: true }, { uri: "https://direct.plex.direct:32400", relay: false }] })?.uri).toBe("https://direct.plex.direct:32400"); });
  it("rejects non-Plex, credentialed, and unusual connection targets", () => { expect(isApprovedConnectionUri("https://server.plex.direct:32400")).toBe(true); expect(isApprovedConnectionUri("https://127.0.0.1:32400")).toBe(false); expect(isApprovedConnectionUri("https://user:pass@server.plex.direct:32400")).toBe(false); expect(isApprovedConnectionUri("https://server.plex.direct:8443")).toBe(false); expect(isApprovedConnectionUri("https://plex.direct.evil.test")).toBe(false); });
  it("allows Plex's path-based HTTPS relay endpoint", () => { expect(isApprovedConnectionUri("https://relay.plex.tv:443/machine-id")).toBe(true); });
  it("allows only metadata artwork paths", () => { expect(validateArtworkPath("/library/metadata/12/thumb/abc")).toBe(true); expect(validateArtworkPath("https://evil.test/x")).toBe(false); expect(validateArtworkPath("/library/metadata/12/../../art")).toBe(false); expect(validateArtworkPath("/art/12")).toBe(false); });
  it("stops reading a chunked response at the byte cap", async () => { const response = new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(4)); controller.enqueue(new Uint8Array(4)); controller.close(); } })); await expect(readLimitedBytes(response, 6)).rejects.toThrow("too large"); });
});
