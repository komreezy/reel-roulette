import { NextResponse } from "next/server";
import { PLEX_CLIENTS_URL, deviceJwt } from "@/lib/pin";
import { pendingCookieName, sessionCookieName, sessionMaxAge, seal, unsealPending, unsealSession } from "@/lib/session";
import { cookies } from "next/headers";
import { completionDocument } from "@/lib/auth-completion";

function completionResponse(state: "connected" | "waiting" | "expired") {
  return new NextResponse(completionDocument(state), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'" } });
}

export async function GET(request: Request) {
  const complete = new URL(request.url).searchParams.get("complete") === "1";
  const store = await cookies();
  const pendingValue = store.get(pendingCookieName)?.value;
  const pending = unsealPending(pendingValue);
  if (!pending) {
    if (unsealSession(store.get(sessionCookieName)?.value)) return complete ? completionResponse("connected") : NextResponse.json({ authenticated: true });
    if (complete) return completionResponse("expired");
    const result = NextResponse.json({ authenticated: false, expired: Boolean(pendingValue) });
    if (pendingValue) result.cookies.delete(pendingCookieName);
    return result;
  }
  try {
    const response = await fetch(`${PLEX_CLIENTS_URL}/api/v2/pins/${pending.id}?deviceJWT=${encodeURIComponent(await deviceJwt(pending))}`, { headers: { Accept: "application/json", "X-Plex-Client-Identifier": pending.clientId }, cache: "no-store" });
    if (!response.ok) return complete ? completionResponse("expired") : NextResponse.json({ authenticated: false });
    const body = await response.json() as { authToken?: unknown };
    if (typeof body.authToken !== "string" || !body.authToken) return complete ? completionResponse("waiting") : NextResponse.json({ authenticated: false });
    const result = complete ? completionResponse("connected") : NextResponse.json({ authenticated: true });
    result.cookies.set(sessionCookieName, await seal({ token: body.authToken, clientId: pending.clientId, expiresAt: Date.now() + sessionMaxAge * 1000 }), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: sessionMaxAge, path: "/" });
    result.cookies.delete(pendingCookieName);
    return result;
  } catch { return NextResponse.json({ error: "Plex authentication could not be checked." }, { status: 502 }); }
}
