import { expect, test, type Locator } from "@playwright/test";

async function expectTouchTarget(control: Locator) {
  const bounds = await control.boundingBox();
  expect(
    bounds,
    `${(await control.getAttribute("aria-label")) ?? (await control.textContent())} is visible`,
  ).not.toBeNull();
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
  expect(bounds!.width).toBeGreaterThanOrEqual(44);
}

test("demo reveals one film and replaces it with a different film", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /leave tonight to chance/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Explore the demo shelf" }).click();
  await expect(
    page.getByText("8 films. All equally possible.", { exact: true }),
  ).toBeVisible();
  const pullButton = page.getByRole("button", {
    name: "Pull a movie",
    exact: true,
  });
  await expect(pullButton).toBeFocused();
  await pullButton.click();
  await expect(
    page.getByRole("button", { name: "Finding your film", exact: true }),
  ).toBeDisabled();
  const result = page.getByRole("region", { name: "Selected movie" });
  await expect(result.getByRole("heading")).toBeVisible();
  const firstTitle = await result.getByRole("heading").innerText();
  await expect(page.getByRole("status")).toContainText(firstTitle);
  await expect(
    result.getByRole("link", { name: "Open in Letterboxd" }),
  ).toHaveAttribute("href", /^https:\/\/letterboxd\.com\/film\/[a-z0-9-]+\/$/);
  await page.getByRole("button", { name: "Pull another", exact: true }).click();
  await expect(result.getByRole("heading")).toBeVisible();
  await expect(result.getByRole("heading")).not.toHaveText(firstTitle);
  await expect(result.getByRole("heading")).toHaveCount(1);
  await expect(page.getByRole("status")).toContainText(
    await result.getByRole("heading").innerText(),
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("archive-result.png"),
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});

test("the whole demo plays without repeats and starts its next cycle silently", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore the demo shelf" }).click();
  const titles: string[] = [];
  for (let draw = 0; draw < 9; draw += 1) {
    await page
      .getByRole("button", {
        name: draw === 0 ? "Pull a movie" : "Pull another",
        exact: true,
      })
      .click();
    const heading = page
      .getByRole("region", { name: "Selected movie" })
      .getByRole("heading");
    await expect(heading).toBeVisible();
    titles.push(await heading.innerText());
  }
  expect(new Set(titles.slice(0, 8)).size).toBe(8);
  expect(titles[8]).not.toBe(titles[7]);
  await expect(
    page.getByRole("button", { name: "Pull another", exact: true }),
  ).toBeEnabled();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    `Your next film is ${titles[8]}`,
  );
});

test("source settings contain keyboard focus and Escape restores it", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore the demo shelf" }).click();
  const sourceButton = page.getByRole("button", {
    name: "Change movie source",
  });
  await sourceButton.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole("button", { name: "Close source settings" });
  const reset = dialog.getByRole("button", { name: "Reset this session" });
  await close.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(reset).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(sourceButton).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Pull a movie", exact: true }),
  ).toBeEnabled();
});

test("reset during an animated pull prevents a late result", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore the demo shelf" }).click();
  await page.getByRole("button", { name: "Pull a movie", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Finding your film", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Change movie source" }).click();
  await page.getByRole("button", { name: "Reset this session" }).click();
  await expect(
    page.getByRole("heading", { name: /leave tonight to chance/i }),
  ).toBeVisible();
  // Wait beyond recovery: no late callback may restore a reset result.
  await page.waitForTimeout(3_700);
  await expect(
    page.getByRole("region", { name: "Selected movie" }).getByRole("heading"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Change movie source" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Explore the demo shelf" }),
  ).toBeVisible();
});

test("setup, source settings, and pull controls remain touch-sized", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  for (const control of [
    page.getByRole("button", { name: "Watchlist", exact: true }),
    page.getByRole("button", { name: "List URL", exact: true }),
    page.getByRole("textbox", { name: "Your Letterboxd username" }),
    page.getByRole("button", { name: "Load shelf", exact: true }),
    page.getByRole("button", { name: "Explore the demo shelf" }),
  ])
    await expectTouchTarget(control);
  await page.getByRole("button", { name: "Explore the demo shelf" }).click();
  await expectTouchTarget(
    page.getByRole("button", { name: "Pull a movie", exact: true }),
  );
  await expectTouchTarget(
    page.getByRole("button", { name: "Change movie source" }),
  );
  await page.getByRole("button", { name: "Change movie source" }).click();
  await expectTouchTarget(
    page.getByRole("button", { name: "Close source settings" }),
  );
  await expectTouchTarget(
    page.getByRole("button", { name: "Reset this session" }),
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("privacy explains the session-only shelf and returns to the archive", async ({
  page,
}) => {
  await page.goto("/privacy");
  await expect(
    page.getByRole("heading", { name: "Privacy, plainly." }),
  ).toBeVisible();
  await expect(
    page.getByText(/refreshing the page clears your shelf/i),
  ).toBeVisible();
  await expect(
    page.getByText(/we never ask for a letterboxd password/i),
  ).toBeVisible();
  await page.getByRole("link", { name: /back to the archive/i }).click();
  await expect(
    page.getByRole("heading", { name: /leave tonight to chance/i }),
  ).toBeVisible();
});
