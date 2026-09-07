import "server-only";
import { decodeHTMLAttribute } from "entities";
import type { Movie } from "./models";

const ORIGIN = "https://letterboxd.com";
const USER_AGENT = "Reel Roulette/0.1 (+https://github.com/komreezy/reel-roulette)";
const REQUEST_TIMEOUT_MS = 10_000;
const COLLECTION_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 2_000_000;
const MAX_PAGES = 100;
const MAX_FILMS = 5_000;

export class LetterboxdError extends Error {
  constructor(public code: "invalid_username" | "invalid_list_url" | "not_found" | "upstream", message: string) { super(message); }
}

export function validatePublicUsername(value: string): string {
  if (!/^[A-Za-z0-9_-]{1,50}$/.test(value)) throw new LetterboxdError("invalid_username", "Enter a valid public Letterboxd username.");
  return value;
}

export function validatePublicListUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new LetterboxdError("invalid_list_url", "Enter a valid public Letterboxd list URL."); }
  const match = url.pathname.match(/^\/([A-Za-z0-9_-]{1,50})\/list\/([A-Za-z0-9_-]{1,100})\/?$/);
  if (url.protocol !== "https:" || url.hostname !== "letterboxd.com" || url.port || url.username || url.password || url.search || url.hash || !match) {
    throw new LetterboxdError("invalid_list_url", "Enter a valid public Letterboxd list URL.");
  }
  return `${ORIGIN}/${match[1]}/list/${match[2]}/`;
}

function attributes(fragment: string): Record<string, string> {
  return Object.fromEntries([...fragment.matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/g)].map(match => [match[1], decodeHTMLAttribute(match[2])]));
}

function parseLazyPosterPage(html: string, watched: boolean) {
  const films: { id: string; title: string; year?: number; externalUrl: string; watched?: true }[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/<div\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    if (attrs["data-component-class"] !== "LazyPoster" && !new RegExp("(?:^|\\s)LazyPoster(?:\\s|$)", "i").test(attrs.class ?? "")) continue;
    const link = attrs["data-item-link"];
    const slug = attrs["data-item-slug"];
    const name = attrs["data-item-name"];
    if (!link || !slug || !name || !/^\/film\/[A-Za-z0-9_-]+\/?$/.test(link)) continue;
    const canonicalPath = `/${link.replace(/^\/+/, "").replace(/\/+$/, "")}/`;
    const externalUrl = `${ORIGIN}${canonicalPath}`;
    if (seen.has(externalUrl)) continue;
    seen.add(externalUrl);
    const yearMatch = name.match(/\s*\((\d{4})\)\s*$/);
    films.push({ id: `letterboxd-${slug}`, title: (yearMatch ? name.slice(0, yearMatch.index) : name).trim(), ...(yearMatch ? { year: Number(yearMatch[1]) } : {}), externalUrl, ...(watched ? { watched: true } : {}) });
  }
  return films;
}

export function parseWatchlistPage(html: string) { return parseLazyPosterPage(html, false); }
export function parseDiaryPage(html: string) { return parseLazyPosterPage(html, true); }

function nextPagePathFor(html: string, paginationPrefix: string, currentPage: number): string | undefined {
  const expected = new RegExp(`^${paginationPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)/$`);
  for (const anchor of html.matchAll(/<a\b[^>]*>/gi)) {
    const attrs = attributes(anchor[0]);
    if (!/\bnext\b/i.test(attrs.class ?? "") || !attrs.href) continue;
    const match = attrs.href.match(expected);
    if (!match) throw new LetterboxdError("upstream", "Letterboxd returned invalid pagination.");
    if (Number(match[1]) !== currentPage + 1) {
      throw new LetterboxdError("upstream", "Letterboxd returned invalid pagination.");
    }
    return attrs.href;
  }
  return undefined;
}

async function readLimitedText(response: Response, timeout: Promise<never>): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    throw new LetterboxdError("upstream", "Letterboxd returned an unexpectedly large page.");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new LetterboxdError("upstream", "Letterboxd returned an unexpectedly large page.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

async function fetchPage(url: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let deadlineTimer!: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => { deadlineTimer = setTimeout(() => reject(new LetterboxdError("upstream", "Letterboxd timed out.")), timeoutMs); });
  try {
    const response = await Promise.race([fetch(url, { signal: controller.signal, cache: "no-store", redirect: "error", headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" } }), timeout]);
    if (response.status === 404) throw new LetterboxdError("not_found", "That public Letterboxd page was not found.");
    if (!response.ok) throw new LetterboxdError("upstream", "Letterboxd could not be reached right now.");
    return await readLimitedText(response, timeout);
  } catch (error) {
    if (error instanceof LetterboxdError) throw error;
    throw new LetterboxdError("upstream", error instanceof DOMException && error.name === "AbortError" ? "Letterboxd timed out." : "Letterboxd could not be reached right now.");
  } finally { clearTimeout(timer); clearTimeout(deadlineTimer); }
}

async function getCollectionFromPaths(initialPath: string, paginationPrefix: string, watched: boolean, label: string): Promise<{ films: Movie[] }> {
  const films: Movie[] = [];
  const seenUrls = new Set<string>();
  let path: string | undefined = initialPath;
  const deadline = Date.now() + COLLECTION_TIMEOUT_MS;
  for (let page = 0; path && page < MAX_PAGES; page += 1) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) throw new LetterboxdError("upstream", "Letterboxd import took too long.");
    const html = await fetchPage(`${ORIGIN}${path}`, Math.min(REQUEST_TIMEOUT_MS, remainingMs));
    const parsed = parseLazyPosterPage(html, watched);
    for (const film of parsed) {
      if (seenUrls.has(film.externalUrl)) continue;
      seenUrls.add(film.externalUrl);
      if (films.length >= MAX_FILMS) throw new LetterboxdError("upstream", `Letterboxd ${label} exceeds the supported size.`);
      films.push({ ...film, genres: [], watched, source: "letterboxd", plexKey: film.id, libraryKey: "letterboxd" });
    }
    path = nextPagePathFor(html, paginationPrefix, page + 1) ?? "";
  }
  if (path) throw new LetterboxdError("upstream", "Letterboxd import has too many pages to process safely.");
  return { films };
}

async function getUserCollection(usernameInput: string, dataset: "watchlist" | "diary") {
  const username = validatePublicUsername(usernameInput);
  const prefix = dataset === "watchlist" ? `/${username}/watchlist/page/` : `/${username}/diary/films/page/`;
  return getCollectionFromPaths(`${prefix}1/`, prefix, dataset === "diary", dataset);
}

export async function getWatchlist(usernameInput: string) { return getUserCollection(usernameInput, "watchlist"); }
export async function getDiary(usernameInput: string) { return getUserCollection(usernameInput, "diary"); }
export async function getList(listUrlInput: string) {
  const listUrl = new URL(validatePublicListUrl(listUrlInput));
  const basePath = listUrl.pathname;
  return getCollectionFromPaths(basePath, `${basePath}page/`, false, "list");
}
