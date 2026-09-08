"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ARCHIVE_ACCENTS, type ArchivePull } from "@/lib/archive-types";
import {
  archiveRandom,
  canonicalLetterboxdUrl,
  dedupeArchiveMovies,
  drawFromArchive,
  emptyArchiveCycle,
  type ArchiveCycle,
} from "@/lib/archive-selection";
import type { Movie } from "@/lib/models";

type ImportKind = "watchlist" | "list";
type ArchiveState = {
  movies: Movie[];
  sourceLabel: string;
  sourceKind: ImportKind | "demo" | null;
  loading: boolean;
  error: string | null;
  notice: string;
  pull: ArchivePull | null;
  winner: Movie | null;
  pulling: boolean;
  drawCount: number;
  remaining: number;
};

const INITIAL_STATE: ArchiveState = {
  movies: [],
  sourceLabel: "",
  sourceKind: null,
  loading: false,
  error: null,
  notice: "",
  pull: null,
  winner: null,
  pulling: false,
  drawCount: 0,
  remaining: 0,
};

const DEMO_FILMS = [
  ["Arrival", 2016, "arrival-2016"],
  ["Moonlight", 2016, "moonlight-2016"],
  ["The Grand Budapest Hotel", 2014, "the-grand-budapest-hotel"],
  ["Blade Runner 2049", 2017, "blade-runner-2049"],
  ["Portrait of a Lady on Fire", 2019, "portrait-of-a-lady-on-fire"],
  ["The Lighthouse", 2019, "the-lighthouse-2019"],
  ["Whiplash", 2014, "whiplash-2014"],
  ["Spirited Away", 2001, "spirited-away"],
] as const;

const demoMovies: Movie[] = DEMO_FILMS.map(([title, year, slug]) => ({
  id: `letterboxd-${slug}`,
  title,
  year,
  genres: [],
  watched: false,
  plexKey: `letterboxd-${slug}`,
  libraryKey: "demo",
  source: "letterboxd",
  externalUrl: `https://letterboxd.com/film/${slug}/`,
}));

function importedMovies(body: unknown): Movie[] {
  if (
    !body ||
    typeof body !== "object" ||
    !("films" in body) ||
    !Array.isArray(body.films)
  ) {
    throw new Error("This collection could not be read. Please try again.");
  }
  const movies: Movie[] = body.films.flatMap((value: unknown) => {
    if (!value || typeof value !== "object") return [];
    const film = value as Partial<Movie>;
    if (
      typeof film.id !== "string" ||
      !film.id ||
      typeof film.title !== "string" ||
      !film.title.trim()
    )
      return [];
    return [
      {
        ...film,
        id: film.id,
        title: film.title.trim(),
        genres: Array.isArray(film.genres)
          ? film.genres.filter((genre) => typeof genre === "string")
          : [],
        watched: film.watched === true,
        plexKey: typeof film.plexKey === "string" ? film.plexKey : film.id,
        libraryKey:
          typeof film.libraryKey === "string" ? film.libraryKey : "letterboxd",
        source: "letterboxd" as const,
        externalUrl: canonicalLetterboxdUrl(
          typeof film.externalUrl === "string" ? film.externalUrl : undefined,
        ),
      },
    ];
  });
  return dedupeArchiveMovies(movies);
}

function importedLabel(kind: ImportKind, value: string): string {
  if (kind === "watchlist") return `@${value}’s watchlist`;
  try {
    const [, owner, , slug] = new URL(value).pathname.split("/");
    return slug ? `${slug.replace(/-/g, " ")} · @${owner}` : "Letterboxd list";
  } catch {
    return "Letterboxd list";
  }
}

function readyNotice(count: number): string {
  return count
    ? `${count} film${count === 1 ? "" : "s"} ready to pull.`
    : "This collection is empty. Try another watchlist or list.";
}

export function useArchive() {
  const [state, setState] = useState<ArchiveState>(INITIAL_STATE);
  const stateRef = useRef<ArchiveState>(INITIAL_STATE);
  const cycleRef = useRef<ArchiveCycle>(emptyArchiveCycle());
  const requestRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const serialRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const pendingRef = useRef<{
    pull: ArchivePull;
    cycle: ArchiveCycle;
    remaining: number;
  } | null>(null);

  const update = useCallback((changes: Partial<ArchiveState>) => {
    stateRef.current = { ...stateRef.current, ...changes };
    if (mountedRef.current) setState(stateRef.current);
  }, []);

  const clearWatchdog = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const invalidateImport = useCallback(() => {
    generationRef.current += 1;
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);

  const cancelPendingDraw = useCallback(() => {
    clearWatchdog();
    if (!pendingRef.current) return;
    pendingRef.current = null;
    // The scene receives null to cancel its timeline as well as this transaction.
    update({ pull: null, winner: null, pulling: false });
  }, [clearWatchdog, update]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      invalidateImport();
      clearWatchdog();
      pendingRef.current = null;
    };
  }, [clearWatchdog, invalidateImport]);

  const cancelImport = useCallback(() => {
    invalidateImport();
    update({
      loading: false,
      error: null,
      notice: stateRef.current.sourceKind
        ? readyNotice(stateRef.current.movies.length)
        : "",
    });
  }, [invalidateImport, update]);

  const installCollection = useCallback(
    (
      movies: Movie[],
      sourceKind: ArchiveState["sourceKind"],
      sourceLabel: string,
    ) => {
      cancelPendingDraw();
      cycleRef.current = emptyArchiveCycle();
      update({
        ...INITIAL_STATE,
        movies,
        sourceKind,
        sourceLabel,
        remaining: movies.length,
        notice: readyNotice(movies.length),
      });
    },
    [cancelPendingDraw, update],
  );

  const importSource = useCallback(
    async (kind: ImportKind, value: string) => {
      invalidateImport();
      cancelPendingDraw();
      const cleanValue =
        kind === "watchlist" ? value.trim().replace(/^@/, "") : value.trim();
      if (!cleanValue) {
        update({
          loading: false,
          error:
            kind === "watchlist"
              ? "Enter your public Letterboxd username."
              : "Paste a public Letterboxd list URL.",
        });
        return;
      }
      const generation = generationRef.current;
      const controller = new AbortController();
      requestRef.current = controller;
      update({
        loading: true,
        error: null,
        notice: `Opening your ${kind === "watchlist" ? "watchlist" : "list"}…`,
      });

      try {
        const query = new URLSearchParams({
          [kind === "watchlist" ? "username" : "url"]: cleanValue,
        });
        const response = await fetch(`/api/letterboxd/${kind}?${query}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body: unknown = await response.json();
        if (generation !== generationRef.current || !mountedRef.current) return;
        if (!response.ok) {
          const message =
            body &&
            typeof body === "object" &&
            "error" in body &&
            typeof body.error === "string"
              ? body.error
              : "Letterboxd could not be reached. Please try again.";
          throw new Error(message);
        }
        installCollection(
          importedMovies(body),
          kind,
          importedLabel(kind, cleanValue),
        );
      } catch (error) {
        if (generation !== generationRef.current || !mountedRef.current) return;
        update({
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Letterboxd could not be reached. Please try again.",
          notice: "",
        });
      } finally {
        if (generation === generationRef.current && mountedRef.current) {
          requestRef.current = null;
          if (stateRef.current.loading) update({ loading: false });
        }
      }
    },
    [cancelPendingDraw, installCollection, invalidateImport, update],
  );

  const useDemo = useCallback(() => {
    invalidateImport();
    installCollection([...demoMovies], "demo", "The house collection");
  }, [installCollection, invalidateImport]);

  const reset = useCallback(() => {
    invalidateImport();
    installCollection([], null, "");
    update({ notice: "" });
  }, [installCollection, invalidateImport, update]);

  const reveal = useCallback(
    (serial: number) => {
      const pending = pendingRef.current;
      if (!pending || pending.pull.serial !== serial || !mountedRef.current)
        return;
      clearWatchdog();
      pendingRef.current = null;
      cycleRef.current = pending.cycle;
      update({
        winner: pending.pull.movie,
        pulling: false,
        drawCount: stateRef.current.drawCount + 1,
        remaining: pending.remaining,
        notice: `Selected ${pending.pull.movie.title}.`,
      });
    },
    [clearWatchdog, update],
  );

  const pullMovie = useCallback(() => {
    const current = stateRef.current;
    if (current.loading || current.pulling || !current.movies.length) return;
    const selection = drawFromArchive(current.movies, cycleRef.current);
    if (!selection.movie) return;
    const pull: ArchivePull = {
      serial: ++serialRef.current,
      movie: selection.movie,
      accent:
        ARCHIVE_ACCENTS[Math.floor(archiveRandom() * ARCHIVE_ACCENTS.length)],
      slotSeed: archiveRandom(),
    };
    pendingRef.current = {
      pull,
      cycle: selection.state,
      remaining: selection.remaining,
    };
    update({
      pull,
      pulling: true,
      error: null,
      notice: "Finding your next movie…",
    });
    clearWatchdog();
    // The scene normally finishes this transaction. Context loss must not lock it.
    timerRef.current = setTimeout(() => reveal(pull.serial), 3_500);
  }, [clearWatchdog, reveal, update]);

  return {
    ...state,
    importSource,
    cancelImport,
    useDemo,
    reset,
    pullMovie,
    reveal,
  };
}
