import { describe, expect, it } from "vitest";
import { chooseUniform, filterMovies } from "./selection";
import type { Movie } from "./models";

const movies: Movie[] = [
  { id: "a", title: "A", genres: ["Drama", "History"], watched: false, runtimeMinutes: 90, plexKey: "a", libraryKey: "1" },
  { id: "b", title: "B", genres: ["Drama"], watched: true, runtimeMinutes: 140, plexKey: "b", libraryKey: "1" },
  { id: "c", title: "C", genres: ["Drama", "History"], watched: false, runtimeMinutes: 110, plexKey: "c", libraryKey: "1" },
];
describe("movie eligibility", () => {
  it("combines watched, every selected genre, runtime, and exclusions", () => expect(filterMovies(movies, { watched: "unwatched", genres: ["Drama", "History"], maxRuntime: 100 }, new Set(["c"])).map((m) => m.id)).toEqual(["a"]));
  it("returns an empty pool honestly", () => expect(filterMovies(movies, { watched: "watched", genres: ["History"], maxRuntime: null })).toEqual([]));
});
describe("uniform choice", () => {
  it("covers lower and upper random boundaries", () => { expect(chooseUniform(["a", "b", "c"], () => 0)).toBe("a"); expect(chooseUniform(["a", "b", "c"], () => 0.999999)).toBe("c"); expect(chooseUniform([], () => 0)).toBeNull(); });
});

