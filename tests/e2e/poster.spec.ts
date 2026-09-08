import { expect, test } from "@playwright/test";

test("portrait enrichment survives replacement without restarting the reveal", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/movies/details?**", route => route.fulfill({ json: { details: { tmdbId: 1, posterUrl: "https://image.tmdb.org/t/p/w500/test.svg", directors: ["Test Director"], runtimeMinutes: 116, genres: ["Drama"], summary: "A carefully chosen film for tonight." } } }));
  await page.route("https://image.tmdb.org/**", route => route.fulfill({ contentType: "image/svg+xml", headers: { "Access-Control-Allow-Origin": "*" }, body: '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750"><rect width="500" height="750" fill="#324c64"/><circle cx="250" cy="270" r="135" fill="#e4b59b"/><text x="250" y="560" text-anchor="middle" fill="white" font-size="36">POSTER TEST</text></svg>' }));
  await page.goto("/");
  await page.getByRole("button", { name: "Explore the demo shelf" }).click();
  await page.getByRole("button", { name: "Pull a movie", exact: true }).click();
  await expect(page.getByText("A film by Test Director")).toBeVisible();
  await expect(page.getByText("116 min", { exact: true })).toBeVisible();
  const first = await page.locator("#result-title").innerText();
  const bounds = await page.locator(".hero-anchor").boundingBox();
  expect(bounds!.height / bounds!.width).toBeCloseTo(1.5, 1);
  await page.getByRole("button", { name: "Pull another", exact: true }).click();
  await expect(page.locator("#result-title")).not.toHaveText(first);
  await expect(page.getByText("A film by Test Director")).toBeVisible();
  await page.screenshot({ path: info.outputPath("portrait.png"), fullPage: true });
  expect(errors).toEqual([]);
});
