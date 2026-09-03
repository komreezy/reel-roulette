import crypto from "node:crypto";

export type Session = { token: string; clientId: string; expiresAt: number };
export type PendingAuth = { id: number; code: string; clientId: string; kid: string; privateKey: string; expiresAt: number };
const COOKIE = "reel_session";
export const pendingCookieName = "reel_pending";
export const sessionMaxAge = 60 * 60 * 8;
export const pendingMaxAge = 60 * 15;

function secretKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters.");
  return crypto.createHash("sha256").update(secret).digest();
}

export async function seal<T>(value: T): Promise<string> {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", secretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv.toString("base64url"), encrypted.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".");
}

export function unseal<T>(value: string | undefined): T | null {
  try {
    if (!value) return null;
    const [iv, encrypted, tag] = value.split(".");
    if (!iv || !encrypted || !tag) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8")) as T;
  } catch { return null; }
}

export async function sealSession(session: Session) { return seal(session); }
export function unsealSession(value?: string): Session | null {
  const session = unseal<Session>(value);
  return session && typeof session.token === "string" && typeof session.clientId === "string" && session.expiresAt > Date.now() ? session : null;
}
export function unsealPending(value?: string): PendingAuth | null {
  const pending = unseal<PendingAuth>(value);
  return pending && Number.isInteger(pending.id) && pending.expiresAt > Date.now() && typeof pending.privateKey === "string" ? pending : null;
}
export const sessionCookieName = COOKIE;
