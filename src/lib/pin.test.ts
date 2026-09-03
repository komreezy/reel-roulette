import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeJwt, decodeProtectedHeader } from "jose";
import { createPendingPin, deviceJwt } from "./pin";

afterEach(() => vi.restoreAllMocks());

describe("Plex JWT PIN contract", () => {
  it("creates an Ed25519-backed PIN and signs the device poll token", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: 42, code: "one-time-code" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );

    const { pending, authUrl } = await createPendingPin("http://localhost:3000");
    const request = fetcher.mock.calls[0];
    const body = JSON.parse(String((request[1] as RequestInit).body));

    expect(String(request[0])).toBe("https://clients.plex.tv/api/v2/pins");
    expect(body).toMatchObject({ strong: true, jwk: { kty: "OKP", crv: "Ed25519", alg: "EdDSA" } });
    expect(body.jwk.x).toEqual(expect.any(String));
    expect(pending.privateKey).toContain("BEGIN PRIVATE KEY");
    expect(authUrl).toContain("https://app.plex.tv/auth#?");
    expect(decodeURIComponent(authUrl)).toContain("/api/plex/auth/status?complete=1");
    expect(authUrl).not.toContain(pending.privateKey);

    const jwt = await deviceJwt(pending);
    expect(decodeProtectedHeader(jwt)).toMatchObject({ alg: "EdDSA", kid: pending.kid });
    expect(decodeJwt(jwt)).toMatchObject({ aud: "plex.tv", iss: pending.clientId });
  });
});
