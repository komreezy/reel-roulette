import { describe, expect, it } from "vitest";
import { matchMovie } from "./movie-details";

describe("movie identity matching", () => {
  const films = [{ id: 1, title: "Suspiria", release_date: "1977-02-01" }, { id: 2, title: "Suspiria", release_date: "2018-01-01" }];
  it("distinguishes remakes by year", () => expect(matchMovie("Suspiria", 2018, films)?.id).toBe(2));
  it("does not guess between ambiguous titles", () => expect(matchMovie("Suspiria", undefined, films)).toBeUndefined());
  it("does not attach a near title or incorrect year", () => {
    expect(matchMovie("Suspiria", 2019, films)).toBeUndefined();
    expect(matchMovie("Suspiria Part Two", 2018, films)).toBeUndefined();
  });
  it("handles accents and original titles", () => expect(matchMovie("Amelie", 2001, [{ id: 3, title: "Amélie", release_date: "2001-04-25" }])?.id).toBe(3));
});
