import type { Movie, MovieFilters } from "./models";

export function filterMovies(movies: Movie[], filters: MovieFilters, excludedIds = new Set<string>()): Movie[] {
  return movies.filter((movie) => {
    if (excludedIds.has(movie.id)) return false;
    if (filters.watched === "watched" && !movie.watched) return false;
    if (filters.watched === "unwatched" && movie.watched) return false;
    if (filters.genres.length && !filters.genres.every((genre) => movie.genres.includes(genre))) return false;
    if (filters.maxRuntime !== null && (movie.runtimeMinutes === undefined || movie.runtimeMinutes > filters.maxRuntime)) return false;
    return true;
  });
}

function secureRandom(): number {
  const value = new Uint32Array(1);
  globalThis.crypto.getRandomValues(value);
  return value[0] / 0x1_0000_0000;
}

export function chooseUniform<T>(items: T[], random = secureRandom): T | null {
  if (!items.length) return null;
  const value = Math.min(Math.max(random(), 0), Number.EPSILON + 0.9999999999999999);
  return items[Math.floor(value * items.length)];
}

export function visualSample<T>(items: T[], limit = 12): T[] {
  if (items.length <= limit) return [...items];
  return Array.from({ length: limit }, (_, index) => items[Math.floor((index * items.length) / limit)]);
}

