import type { Movie } from "./models";
import type { MovieDetails } from "./movie-details";

const requests = new Map<string, Promise<MovieDetails>>();
export function prepareMovie(movie: Movie): Promise<MovieDetails> {
  const key = `${movie.title}:${movie.year ?? ""}:${movie.externalUrl ?? ""}`;
  const cached = requests.get(key);
  if (cached) return cached;
  const request = (async () => {
    try {
      const query = new URLSearchParams({ title: movie.title });
      if (movie.year) query.set("year", String(movie.year));
      if (movie.externalUrl) query.set("film", movie.externalUrl);
      const response = await fetch(`/api/movies/details?${query}`, { signal: AbortSignal.timeout(7000) });
      if (!response.ok) return {};
      const { details } = await response.json();
      if (!details) return {};
      if (details.posterUrl) {
        const poster = new Image();
        poster.crossOrigin = "anonymous";
        poster.src = details.posterUrl;
        await Promise.race([poster.decode().catch(() => { delete details.posterUrl; }), new Promise(resolve => setTimeout(resolve, 2500))]);
      }
      return details;
    } catch { return {}; }
  })();
  if (requests.size >= 150) requests.delete(requests.keys().next().value!);
  requests.set(key, request);
  return request;
}
