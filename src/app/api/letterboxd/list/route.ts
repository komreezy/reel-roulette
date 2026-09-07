import { NextResponse } from "next/server";
import { getList, LetterboxdError } from "@/lib/letterboxd";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const listUrl = new URL(request.url).searchParams.get("url")?.trim();
  if (!listUrl) return NextResponse.json({ error: "A public Letterboxd list URL is required." }, { status: 400, headers: { "cache-control": "no-store" } });
  try {
    return NextResponse.json(await getList(listUrl), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const status = error instanceof LetterboxdError && error.code === "invalid_list_url" ? 400 : error instanceof LetterboxdError && error.code === "not_found" ? 404 : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Letterboxd list import failed." }, { status, headers: { "cache-control": "no-store" } });
  }
}
