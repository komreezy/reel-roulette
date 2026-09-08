import { matchMovie, type MovieCandidate, type MovieDetails } from "@/lib/movie-details";
import { getFilmTmdbId } from "@/lib/letterboxd";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const title = params.get("title")?.trim();
  const rawYear = params.get("year");
  const year = rawYear === null ? undefined : Number(rawYear);
  if (!title || title.length > 300 || (year !== undefined && (!Number.isInteger(year) || year < 1800 || year > 2200))) {
    return Response.json({ error: "Invalid movie." }, { status: 400 });
  }
  const token = process.env.TMDB_API_READ_TOKEN;
  if (!token) return Response.json({ details: null }, { status: 503 });
  const signal = AbortSignal.timeout(6000);
  async function tmdb(path: string) {
    const response = await fetch(`https://api.themoviedb.org/3/${path}`, {
      headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
      signal, next: { revalidate: 86400 },
    });
    if (!response.ok) throw new Error("Movie details unavailable");
    return response.json();
  }
  try {
    const query = new URLSearchParams({ query: title, language: "en-US", include_adult: "false" });
    if (year) query.set("year", String(year));
    const search = await tmdb(`search/movie?${query}`);
    const movie = matchMovie(title, year, (search.results ?? []) as MovieCandidate[]);
    const movieId = movie?.id ?? await getFilmTmdbId(params.get("film") ?? "");
    if (!movieId) return Response.json({ details: null }, { headers: { "Cache-Control": "public, max-age=3600" } });
    const data = await tmdb(`movie/${movieId}?append_to_response=credits&language=en-US`);
    const details: MovieDetails = {
      tmdbId: movieId,
      ...(typeof data.poster_path === "string" && /^\/[A-Za-z0-9]+\.(jpg|png)$/.test(data.poster_path) ? { posterUrl: `https://image.tmdb.org/t/p/w500${data.poster_path}` } : {}),
      ...(data.overview ? { summary: data.overview } : {}),
      ...(data.runtime > 0 ? { runtimeMinutes: data.runtime } : {}),
      genres: (data.genres ?? []).map((genre: { name: string }) => genre.name),
      directors: [...new Set<string>((data.credits?.crew ?? []).filter((person: { job: string }) => person.job === "Director").map((person: { name: string }) => person.name))],
    };
    return Response.json({ details }, { headers: { "Cache-Control": "public, max-age=86400" } });
  } catch {
    return Response.json({ details: null }, { status: 502 });
  }
}
