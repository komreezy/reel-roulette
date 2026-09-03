import { NextResponse } from "next/server";
import { createPendingPin } from "@/lib/pin";
import { pendingCookieName, pendingMaxAge, seal } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const origin = new URL(request.url).origin;
    const { pending, authUrl } = await createPendingPin(origin);
    const response = NextResponse.json({ url: authUrl });
    response.cookies.set(pendingCookieName, await seal(pending), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: pendingMaxAge, path: "/" });
    return response;
  } catch { return NextResponse.json({ error: "Plex authentication is temporarily unavailable." }, { status: 502 }); }
}
