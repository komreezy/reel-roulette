import { NextResponse } from "next/server";
import { getServers, PlexError } from "@/lib/plex";
import { getSession } from "@/lib/request";
export async function GET() { const session = await getSession(); if (!session) return NextResponse.json({ error: "Connect Plex to continue." }, { status: 401 }); try { return NextResponse.json({ servers: (await getServers(session.token, session.clientId)).map(({ id, name, product, machineIdentifier }) => ({ id, name, product, machineIdentifier })) }); } catch (error) { const e = error as PlexError; return NextResponse.json({ error: e.message }, { status: e.code === "unauthorized" ? 401 : 502 }); } }
