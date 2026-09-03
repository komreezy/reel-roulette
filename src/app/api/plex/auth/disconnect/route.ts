import { NextResponse } from "next/server";
import { pendingCookieName, sessionCookieName } from "@/lib/session";
export async function POST() { const response = NextResponse.json({ disconnected: true }); response.cookies.delete(sessionCookieName); response.cookies.delete(pendingCookieName); return response; }
