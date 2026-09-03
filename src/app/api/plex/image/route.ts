import { NextResponse } from "next/server";
import { validateArtworkPath, resolveServer, PlexError, readLimitedBytes } from "@/lib/plex";
import { getSession } from "@/lib/request";
const types = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
export async function GET(request: Request) {
  const session = await getSession(); const params = new URL(request.url).searchParams; const server = params.get("server"); const path = params.get("path");
  if (!session || !server || !path || !validateArtworkPath(path)) return NextResponse.json({ error: "Image unavailable." }, { status: 400 });
  try { const connection = await resolveServer(session.token, session.clientId, server); const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 5000); let response: Response; try { response = await fetch(`${connection.uri}${path}`, { headers: { Accept: "image/*", "X-Plex-Token": connection.token, "X-Plex-Client-Identifier": session.clientId }, redirect: "error", cache: "no-store", signal: controller.signal }); } finally { clearTimeout(timer); } if (!response.ok || !types.has((response.headers.get("content-type") ?? "").split(";")[0].toLowerCase())) return NextResponse.json({ error: "Image unavailable." }, { status: 502 }); const data = await readLimitedBytes(response, 5 * 1024 * 1024); const body = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer; return new NextResponse(body, { headers: { "Content-Type": response.headers.get("content-type") ?? "image/jpeg", "Cache-Control": "private, no-store" } }); } catch (error) { return NextResponse.json({ error: error instanceof PlexError ? error.message : "Image unavailable." }, { status: 502 }); }
}
