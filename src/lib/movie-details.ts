export type MovieDetails = {
  tmdbId?: number;
  posterUrl?: string;
  directors?: string[];
  summary?: string;
  runtimeMinutes?: number;
  genres?: string[];
};

export type MovieCandidate = { id: number; title: string; original_title?: string; release_date?: string };
const normalize = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

export function matchMovie(title: string, year: number | undefined, candidates: MovieCandidate[]) {
  const matches = candidates.filter(movie =>
    (normalize(movie.title) === normalize(title) || normalize(movie.original_title ?? "") === normalize(title)) &&
    (year === undefined || Number(movie.release_date?.slice(0, 4)) === year),
  );
  return matches.length === 1 ? matches[0] : undefined;
}
