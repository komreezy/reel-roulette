import { describe, expect, it } from "vitest";
import {
  canonicalLetterboxdUrl,
  dedupeArchiveMovies,
  drawFromArchive,
  emptyArchiveCycle,
} from "./archive-selection";
import type { Movie } from "./models";

const films: Movie[] = ["a", "b", "c"].map((id) => ({
  id,
  title: id.toUpperCase(),
  genres: [],
  watched: false,
  plexKey: id,
  libraryKey: "letterboxd",
  externalUrl: `https://letterboxd.com/film/${id}/`,
}));

describe("archive selection", () => {
  it("handles an empty collection without consuming randomness", () => {
    const result = drawFromArchive([], emptyArchiveCycle(), () => {
      throw new Error("No draw expected");
    });
    expect(result.movie).toBeNull();
    expect(result.remaining).toBe(0);
  });

  it("returns every film exactly once before silently beginning a new cycle", () => {
    let cycle = emptyArchiveCycle();
    const selected: string[] = [];
    for (let index = 0; index < films.length; index += 1) {
      const result = drawFromArchive(films, cycle, () => 0);
      cycle = result.state;
      selected.push(result.movie!.id);
      expect(result.remaining).toBe(films.length - index - 1);
      expect(result.restarted).toBe(false);
    }
    expect(selected).toEqual(["a", "b", "c"]);
    const next = drawFromArchive(films, cycle, () => 0);
    expect(next.restarted).toBe(true);
    expect(next.movie?.id).toBe("a");
    expect(next.remaining).toBe(2);
  });

  it("cannot immediately repeat the previous film across a cycle boundary", () => {
    let result = drawFromArchive(films, emptyArchiveCycle(), () => 0.999);
    result = drawFromArchive(films, result.state, () => 0.999);
    result = drawFromArchive(films, result.state, () => 0.999);
    expect(result.movie?.id).toBe("a");
    result = drawFromArchive(films, result.state, () => 0);
    expect(result.movie?.id).toBe("b");
    // The boundary exclusion lasts one pull only; the old final film is still
    // eligible in the new cycle and the cycle retains all three movies.
    result = drawFromArchive(films, result.state, () => 0);
    expect(result.movie?.id).toBe("a");
  });

  it("continues working with a one-film collection", () => {
    const first = drawFromArchive([films[0]], emptyArchiveCycle(), () => 0.5);
    const second = drawFromArchive([films[0]], first.state, () => 0.5);
    expect(first.movie?.id).toBe("a");
    expect(second.movie?.id).toBe("a");
    expect(second.restarted).toBe(true);
  });

  it("gives every remaining film the same size random interval", () => {
    const first = drawFromArchive(films, emptyArchiveCycle(), () => 0.5);
    const counts = { a: 0, c: 0 };
    for (let sample = 0; sample < 100; sample += 1) {
      const result = drawFromArchive(
        films,
        first.state,
        () => (sample + 0.5) / 100,
      );
      counts[result.movie!.id as "a" | "c"] += 1;
    }
    expect(counts).toEqual({ a: 50, c: 50 });
    expect(first.state.seenKeys).toHaveLength(1);
  });

  it("deduplicates both canonical film URLs and source IDs", () => {
    const duplicateRows = [
      films[0],
      {
        ...films[0],
        id: "another-id",
        externalUrl: "https://letterboxd.com/film/a?from=list#film",
      },
      { ...films[0], externalUrl: undefined },
      films[1],
    ];
    expect(dedupeArchiveMovies(duplicateRows).map((movie) => movie.id)).toEqual(
      ["a", "b"],
    );
    expect(
      drawFromArchive(duplicateRows, emptyArchiveCycle(), () => 0.5).movie?.id,
    ).toBe("b");
  });

  it("bounds injected randomness and never mutates the source or prior cycle", () => {
    const state = Object.freeze({ seenKeys: Object.freeze([]), lastKey: null });
    const movies = Object.freeze([...films]);
    expect(drawFromArchive(movies, state, () => 1).movie?.id).toBe("c");
    expect(drawFromArchive(movies, state, () => -1).movie?.id).toBe("a");
    expect(drawFromArchive(movies, state, () => Number.NaN).movie?.id).toBe(
      "a",
    );
    expect(state.seenKeys).toEqual([]);
  });
});

describe("Letterboxd outbound URLs", () => {
  it("normalizes public film pages and rejects non-film or unsafe targets", () => {
    expect(
      canonicalLetterboxdUrl(
        "https://letterboxd.com/film/arrival-2016?ref=list#poster",
      ),
    ).toBe("https://letterboxd.com/film/arrival-2016/");
    for (const target of [
      "javascript:alert(1)",
      "https://letterboxd.com.evil.test/film/a/",
      "https://user@letterboxd.com/film/a/",
      "http://letterboxd.com/film/a/",
      "https://letterboxd.com/user/list/a/",
    ]) {
      expect(canonicalLetterboxdUrl(target)).toBeUndefined();
    }
  });
});
