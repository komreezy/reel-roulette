import type { Movie } from "./models";

export type ArchiveCycle = {
  seenKeys: readonly string[];
  lastKey: string | null;
};

export type ArchiveDraw = {
  movie: Movie | null;
  state: ArchiveCycle;
  remaining: number;
  restarted: boolean;
};

export function emptyArchiveCycle(): ArchiveCycle {
  return { seenKeys: [], lastKey: null };
}

export function archiveRandom(): number {
  const value = new Uint32Array(1);
  globalThis.crypto.getRandomValues(value);
  return value[0] / 0x1_0000_0000;
}

/** Only canonical public film pages are eligible for the outbound action. */
export function canonicalLetterboxdUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    const film = url.pathname.match(/^\/film\/([A-Za-z0-9_-]+)\/?$/);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "letterboxd.com" ||
      url.port ||
      url.username ||
      url.password ||
      !film
    )
      return undefined;
    return `https://letterboxd.com/film/${film[1].toLowerCase()}/`;
  } catch {
    return undefined;
  }
}

function movieKey(movie: Movie): string {
  return canonicalLetterboxdUrl(movie.externalUrl) ?? `id:${movie.id}`;
}

/** A duplicated source row must never give a film a second ticket. */
export function dedupeArchiveMovies(movies: readonly Movie[]): Movie[] {
  const ids = new Set<string>();
  const urls = new Set<string>();
  return movies.filter((movie) => {
    const url = canonicalLetterboxdUrl(movie.externalUrl);
    const duplicate = ids.has(movie.id) || (url !== undefined && urls.has(url));
    ids.add(movie.id);
    if (url) urls.add(url);
    return !duplicate;
  });
}

/**
 * Select first, animate second. This pure transaction is committed by the
 * controller only once the result is revealed, so canceled pulls skip nothing.
 */
export function drawFromArchive(
  movies: readonly Movie[],
  state: ArchiveCycle = emptyArchiveCycle(),
  random: () => number = archiveRandom,
): ArchiveDraw {
  const unique = dedupeArchiveMovies(movies);
  if (!unique.length)
    return {
      movie: null,
      state: emptyArchiveCycle(),
      remaining: 0,
      restarted: false,
    };

  const availableKeys = new Set(unique.map(movieKey));
  let seenKeys = state.seenKeys.filter((key) => availableKeys.has(key));
  let seen = new Set(seenKeys);
  let candidates = unique.filter((movie) => !seen.has(movieKey(movie)));
  const restarted = candidates.length === 0;

  if (restarted) {
    seenKeys = [];
    seen = new Set();
    candidates =
      unique.length > 1
        ? unique.filter((movie) => movieKey(movie) !== state.lastKey)
        : unique;
  }

  const sample = random();
  const unit = Number.isFinite(sample)
    ? Math.max(0, Math.min(1 - Number.EPSILON, sample))
    : 0;
  const movie = candidates[Math.floor(unit * candidates.length)];
  const key = movieKey(movie);
  seen.add(key);
  return {
    movie,
    state: { seenKeys: [...seen], lastKey: key },
    remaining: unique.length - seen.size,
    restarted,
  };
}
