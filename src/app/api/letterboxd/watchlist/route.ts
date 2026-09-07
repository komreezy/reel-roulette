import { NextResponse } from "next/server";
import { getWatchlist, LetterboxdError } from "@/lib/letterboxd";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const username = new URL(request.url).searchParams.get("username")?.trim();
  if (!username) return NextResponse.json({ error: "A public Letterboxd username is required." }, { status: 400, headers: { "cache-control": "no-store" } });
  try {
    return NextResponse.json(await getWatchlist(username), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const status = error instanceof LetterboxdError && error.code === "invalid_username" ? 400 : error instanceof LetterboxdError && error.code === "not_found" ? 404 : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Letterboxd import failed." }, { status, headers: { "cache-control": "no-store" } });
  }
}
