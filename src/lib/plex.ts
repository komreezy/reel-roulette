import type { Movie, PlexServer } from "./models";
import { PLEX_CLIENTS_URL, PLEX_PRODUCT } from "./pin";
export const TIMEOUT_MS = 7000;
const MAX_BODY = 4 * 1024 * 1024;
export class PlexError extends Error { constructor(public code: "unauthorized" | "unreachable" | "upstream" | "invalid", message: string) { super(message); } }
type Resource = PlexServer & { accessToken: string; rawConnections: { uri: string; local?: unknown; relay?: unknown }[] };
type ResolvedConnection = { uri: string; token: string; machineIdentifier: string; credentialKind?: "resource" | "jwt"; connectionKind?: "direct" | "relay"; hostKind?: "plex.direct" | "plex.services" | "relay.plex.tv" };
const str = (v: unknown) => typeof v === "string" && v ? v : undefined;
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : undefined; };
export function parseXmlAttributes(xml: string, tag: string) { return [...xml.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, "gi"))].map(m => Object.fromEntries([...m[1].matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g)].map(a => [a[1], a[2]]))); }
export function parsePayload(payload: unknown, tag: string): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter((value): value is Record<string, unknown> => Boolean(value && typeof value === "object"));
  if (typeof payload === "string") return parseXmlAttributes(payload, tag);
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>; const container = (root.MediaContainer ?? root) as Record<string, unknown>;
  const list = container[tag] ?? container.Metadata ?? root[tag]; return Array.isArray(list) ? list.filter((v): v is Record<string, unknown> => Boolean(v && typeof v === "object")) : [];
}
export async function readLimitedBytes(response: Response, limit: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) throw new PlexError("upstream", "Plex response was too large.");
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) { await reader.cancel(); throw new PlexError("upstream", "Plex response was too large."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
async function read(response: Response): Promise<unknown> {
  const text = new TextDecoder().decode(await readLimitedBytes(response, MAX_BODY)); return (response.headers.get("content-type") ?? "").includes("json") ? JSON.parse(text) : text;
}
async function fetchWithTimeout(url: string, token: string, clientId: string, init: RequestInit = {}) {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try { const response = await fetch(url, { ...init, redirect: "error", cache: "no-store", signal: controller.signal, headers: { Accept: "application/json, application/xml", "X-Plex-Token": token, "X-Plex-Client-Identifier": clientId, "X-Plex-Product": PLEX_PRODUCT, ...(init.headers ?? {}) } }); if (response.status === 401 || response.status === 403) throw new PlexError("unauthorized", "Plex authorization expired."); return response; } catch (e) { if (e instanceof PlexError) throw e; throw new PlexError("unreachable", "This Plex server could not be reached. Hosted apps need secure Remote Access or Relay."); } finally { clearTimeout(timeout); }
}
export async function getResources(token: string, clientId: string): Promise<Resource[]> {
  const response = await fetchWithTimeout(`${PLEX_CLIENTS_URL}/api/v2/resources?includeHttps=1&includeRelay=1&includeIPv6=1`, token, clientId); if (!response.ok) throw new PlexError("upstream", "Plex resources could not be loaded.");
  const data = parsePayload(await read(response), "Device"); return data.map((item, index) => {
    const connections = Array.isArray(item.connections) ? item.connections : Array.isArray(item.Connection) ? item.Connection : [];
    const rawConnections = connections.map(c => { const x = c as Record<string, unknown>; return { uri: str(x.uri) ?? "", local: x.local, relay: x.relay }; }).filter(c => c.uri);
    return { id: str(item.clientIdentifier) ?? `server-${index}`, machineIdentifier: str(item.clientIdentifier) ?? `server-${index}`, name: str(item.name) ?? "Plex server", product: str(item.product) ?? "", accessToken: str(item.accessToken) ?? "", connections: rawConnections.map(c => ({ uri: c.uri, local: c.local === true || c.local === "1", relay: c.relay === true || c.relay === "1" })), rawConnections };
  }).filter(s => s.product.toLowerCase() === "plex media server" && s.accessToken);
}
export async function getServers(token: string, clientId: string) { return getResources(token, clientId); }
export function isApprovedConnectionUri(uri: string) { try { const url = new URL(uri); const host = url.hostname.toLowerCase(); if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return false; const relay = (host === "relay.plex.tv" || host.endsWith(".relay.plex.tv")) && (!url.port || url.port === "443"); const managed = (host.endsWith(".plex.direct") || host.endsWith(".plex.services")) && (!url.port || url.port === "443" || url.port === "32400") && (url.pathname === "/" || url.pathname === ""); return relay || managed; } catch { return false; } }
export function orderedConnections(server: Pick<Resource, "rawConnections">) { return server.rawConnections.filter(c => isApprovedConnectionUri(c.uri) && c.local !== true && c.local !== "1").sort((a, b) => Number(a.relay === true || a.relay === "1") - Number(b.relay === true || b.relay === "1")); }
export function chooseConnection(server: Pick<Resource, "rawConnections">) { return orderedConnections(server)[0] ?? null; }
function hostKind(uri: string): ResolvedConnection["hostKind"] { const host = new URL(uri).hostname.toLowerCase(); return host.endsWith(".plex.direct") ? "plex.direct" : host.endsWith(".plex.services") ? "plex.services" : "relay.plex.tv"; }
function diagnostic(event: Record<string, unknown>) { console.info("[reel-plex-diag]", JSON.stringify(event)); }
export async function resolveServer(token: string, clientId: string, id: string) {
  const server = (await getResources(token, clientId)).find(s => s.id === id); if (!server) throw new PlexError("unreachable", "This Plex server is no longer available.");
  const connections = orderedConnections(server);
  for (const credential of [...new Set([server.accessToken, token])]) {
    for (const connection of connections) {
      const uri = connection.uri.replace(/\/$/, "");
      const context = { stage: "sections-probe", credential: credential === server.accessToken ? "resource" : "jwt", connection: connection.relay === true || connection.relay === "1" ? "relay" : "direct", host: hostKind(uri) }; const started = Date.now();
      try { let probe = await fetchWithTimeout(`${uri}/library/sections`, credential, clientId); if (probe.status === 404) probe = await fetchWithTimeout(`${uri}/library/sections/all`, credential, clientId); diagnostic({ ...context, outcome: "http", status: probe.status, elapsedMs: Date.now() - started }); if (probe.ok) return { uri, token: credential, machineIdentifier: server.machineIdentifier, credentialKind: context.credential, connectionKind: context.connection, hostKind: context.host } as ResolvedConnection; }
      catch (error) { diagnostic({ ...context, outcome: "error", error: error instanceof PlexError ? error.code : "unknown", elapsedMs: Date.now() - started }); continue; }
    }
  }
  throw new PlexError("unreachable", "This server could not be reached through secure Remote Access or Plex Relay.");
}
export function validateArtworkPath(path: string) { if (!path || path.length > 500 || !path.startsWith("/") || path.startsWith("//") || /%2f|%2e|\\/i.test(path) || path.split("/").some(p => p === "." || p === "..") || !/^\/library\/metadata\/\d+\/(thumb|art)(?:\/[^/?#]*)?$/.test(path)) return false; return true; }
export async function getLibraries(connection: { uri: string; token: string; credentialKind?: string; connectionKind?: string; hostKind?: string }, clientId: string) { const context = { stage: "libraries", credential: connection.credentialKind ?? "test", connection: connection.connectionKind ?? "test", host: connection.hostKind ?? "test" }; const started = Date.now(); try { let response = await fetchWithTimeout(`${connection.uri}/library/sections`, connection.token, clientId); if (response.status === 404) response = await fetchWithTimeout(`${connection.uri}/library/sections/all`, connection.token, clientId); diagnostic({ ...context, outcome: "http", status: response.status, elapsedMs: Date.now() - started }); if (!response.ok) throw new PlexError("upstream", "Plex libraries could not be loaded."); const libraries = parsePayload(await read(response), "Directory").filter(i => i.type === "movie").map(i => ({ key: String(i.key), title: str(i.title) ?? "Movies", type: "movie" as const })); diagnostic({ ...context, outcome: "parsed", movieLibraryCount: libraries.length, elapsedMs: Date.now() - started }); return libraries; } catch (error) { diagnostic({ ...context, outcome: "error", error: error instanceof PlexError ? error.code : "unknown", elapsedMs: Date.now() - started }); throw error; } }
export async function getMovies(connection: { uri: string; token: string }, libraryKey: string, clientId: string) {
  if (!/^\d+$/.test(libraryKey)) throw new PlexError("invalid", "Invalid library selection."); const all: Record<string, unknown>[] = []; const page = 100; const cap = 5000;
  for (let offset = 0; offset < cap;) { const response = await fetchWithTimeout(`${connection.uri}/library/sections/${libraryKey}/all?type=1&includeGuids=1`, connection.token, clientId, { headers: { "X-Plex-Container-Start": String(offset), "X-Plex-Container-Size": String(page) } }); if (!response.ok) throw new PlexError("upstream", "Plex movies could not be loaded."); const body = await read(response); const items = parsePayload(body, "Video"); if (!items.length) break; all.push(...items); const container = (typeof body === "object" && body ? ((body as Record<string, unknown>).MediaContainer as Record<string, unknown>) : {}) ?? {}; const total = num(container.totalSize) ?? num(container.size); offset += items.length; if (total !== undefined && offset >= total) break; if (items.length < 1) break; }
  return all.slice(0, cap).map((item, index) => { const genres = Array.isArray(item.Genre) ? item.Genre.map(g => str((g as Record<string, unknown>).tag)).filter((x): x is string => Boolean(x)) : []; const ratingKey = str(item.ratingKey) ?? `movie-${index}`; return { id: ratingKey, title: str(item.title) ?? "Untitled", year: num(item.year), summary: str(item.summary), runtimeMinutes: num(item.duration) ? Math.round(Number(item.duration) / 60000) : undefined, contentRating: str(item.contentRating), genres, watched: Number(item.viewCount ?? 0) > 0, rating: num(item.rating), audienceRating: num(item.audienceRating), thumb: str(item.thumb), art: str(item.art), plexKey: ratingKey, libraryKey } satisfies Movie; });
}
