import { expect, test } from "@playwright/test";

test.use({ launchOptions: { args: ["--disable-webgl", "--disable-webgl2"] } });

test("the flat shelf still reveals and replaces a movie without WebGL", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore the demo shelf" }).click();
  await page.getByRole("button", { name: "Pull a movie", exact: true }).click();
  const result = page.getByRole("region", { name: "Selected movie" });
  await expect(result.getByRole("heading")).toBeVisible();
  const firstTitle = await result.getByRole("heading").innerText();
  await expect(page.locator(".flat-cassette")).toBeVisible();
  await expect(
    result.getByRole("link", { name: "Open in Letterboxd" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pull another", exact: true }).click();
  await expect(result.getByRole("heading")).not.toHaveText(firstTitle);
  await expect(page.locator(".flat-cassette")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pull another", exact: true }),
  ).toBeEnabled();
});
