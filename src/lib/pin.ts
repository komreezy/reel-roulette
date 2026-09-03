import { importPKCS8, SignJWT } from "jose";
import crypto from "node:crypto";
import type { PendingAuth } from "./session";

export const PLEX_PRODUCT = "Reel Roulette";
export const PLEX_CLIENTS_URL = "https://clients.plex.tv";
export async function createPendingPin(requestOrigin: string): Promise<{ pending: PendingAuth; authUrl: string }> {
  const clientId = `reel-roulette-${crypto.randomUUID()}`;
  const kid = crypto.randomUUID();
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const jwk = publicKey.export({ format: "jwk" });
  const response = await fetch(`${PLEX_CLIENTS_URL}/api/v2/pins`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", "X-Plex-Client-Identifier": clientId, "X-Plex-Product": PLEX_PRODUCT }, body: JSON.stringify({ jwk: { ...jwk, kid, alg: "EdDSA" }, strong: true }), cache: "no-store" });
  if (!response.ok) throw new Error("Plex authentication is temporarily unavailable.");
  const body = await response.json() as { id?: number | string; code?: string };
  const id = Number(body.id);
  if (!Number.isInteger(id) || !body.code) throw new Error("Plex returned an invalid PIN.");
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const pending = { id, code: body.code, clientId, kid, privateKey: pem, expiresAt: Date.now() + 15 * 60_000 };
  const configured = process.env.APP_ORIGIN;
  if (process.env.NODE_ENV === "production" && !configured) throw new Error("APP_ORIGIN must be configured in production.");
  const candidate = configured || requestOrigin || "http://localhost:3000";
  const parsedOrigin = new URL(candidate);
  if (process.env.NODE_ENV === "production" && parsedOrigin.protocol !== "https:") throw new Error("APP_ORIGIN must be an allowlisted HTTPS origin.");
  if (parsedOrigin.username || parsedOrigin.password) throw new Error("APP_ORIGIN must not contain credentials.");
  const forwardUrl = `${parsedOrigin.origin}/api/plex/auth/status`;
  const authUrl = `https://app.plex.tv/auth#?clientID=${encodeURIComponent(clientId)}&code=${encodeURIComponent(body.code)}&context%5Bdevice%5D%5Bproduct%5D=${encodeURIComponent(PLEX_PRODUCT)}&forwardUrl=${encodeURIComponent(forwardUrl)}`;
  return { pending, authUrl };
}
export async function deviceJwt(pending: PendingAuth) {
  const key = await importPKCS8(pending.privateKey, "EdDSA");
  return new SignJWT({ aud: "plex.tv", iss: pending.clientId }).setProtectedHeader({ alg: "EdDSA", kid: pending.kid, typ: "JWT" }).setIssuedAt().setExpirationTime("2m").sign(key);
}
