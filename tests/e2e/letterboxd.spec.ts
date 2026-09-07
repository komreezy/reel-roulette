import { expect, test } from "@playwright/test";

test("imports a Letterboxd watchlist and opens the selected film", async ({ page }) => {
  await page.route("**/api/plex/auth/status", route => route.fulfill({ json: { authenticated: false } }));
  await page.route("**/api/letterboxd/watchlist?username=film_fan-7", route => route.fulfill({ json: {
    films: [{ id: "letterboxd-one", title: "One", year: 2020, genres: [], watched: false, source: "letterboxd", externalUrl: "https://letterboxd.com/film/one/", plexKey: "letterboxd-one", libraryKey: "letterboxd" }],
  } }));
  await page.goto("/");
  await page.getByLabel("Movie source").selectOption("letterboxd");
  await page.getByLabel("Letterboxd username").fill("film_fan-7");
  for (const control of [page.getByLabel("Movie source"), page.getByLabel("Letterboxd dataset"), page.getByLabel("Letterboxd username"), page.getByRole("button", { name: /import watchlist/i })]) {
    expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole("button", { name: /import watchlist/i }).click();
  await expect(page.getByText("1 eligible film", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "One" }).click();
  await expect(page.getByRole("link", { name: /open in letterboxd/i })).toHaveAttribute("href", "https://letterboxd.com/film/one/");
});

test("starting another import during a spin cancels the pending result", async ({ page }) => {
  await page.route("**/api/plex/auth/status", route => route.fulfill({ json: { authenticated: false } }));
  await page.route("**/api/letterboxd/watchlist?username=film_fan-7", route => route.fulfill({ json: {
    films: [{ id: "letterboxd-film-one", title: "Film One", genres: [], watched: false }],
  } }));
  await page.goto("/");
  await page.getByLabel("Movie source").selectOption("letterboxd");
  await page.getByLabel("Letterboxd username").fill("film_fan-7");
  await page.getByRole("button", { name: /import watchlist/i }).click();
  await page.getByRole("button", { name: "Spin", exact: true }).click();
  await page.getByRole("button", { name: /import watchlist/i }).click();
  await page.waitForTimeout(1_200);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Spin", exact: true })).toBeEnabled();
});

test("imports a public curated Letterboxd list URL", async ({ page }) => {
  await page.route("**/api/plex/auth/status", route => route.fulfill({ json: { authenticated: false } }));
  await page.route("**/api/letterboxd/list?url=https%3A%2F%2Fletterboxd.com%2Ffilm_fan-7%2Flist%2Fweekend-picks%2F", route => route.fulfill({ json: {
    films: [{ id: "letterboxd-one", title: "One", year: 2020, genres: [], watched: false, source: "letterboxd", externalUrl: "https://letterboxd.com/film/one/", plexKey: "letterboxd-one", libraryKey: "letterboxd" }],
  } }));
  await page.goto("/");
  await page.getByLabel("Movie source").selectOption("letterboxd");
  await page.getByLabel("Letterboxd dataset").selectOption("list");
  await expect(page.getByRole("status")).toHaveText("Paste a public Letterboxd list URL.");
  await page.getByLabel("Letterboxd list URL").fill("https://letterboxd.com/film_fan-7/list/weekend-picks/");
  await page.getByRole("button", { name: /import list/i }).click();
  await expect(page.getByText("1 eligible film", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("1 film imported from Letterboxd list.");
});

test("ignores a completed import after the user changes sources", async ({ page }) => {
  await page.route("**/api/plex/auth/status", route => route.fulfill({ json: { authenticated: false } }));
  let finishImport!: () => void;
  const importMayFinish = new Promise<void>(resolve => { finishImport = resolve; });
  await page.route("**/api/letterboxd/watchlist?username=film_fan-7", async route => {
    await importMayFinish;
    await route.fulfill({ json: { films: [{ id: "letterboxd-late", title: "Late result", genres: [], watched: false, source: "letterboxd", externalUrl: "https://letterboxd.com/film/late-result/", plexKey: "letterboxd-late", libraryKey: "letterboxd" }] } });
  });
  await page.goto("/");
  await page.getByLabel("Movie source").selectOption("letterboxd");
  await page.getByLabel("Letterboxd username").fill("film_fan-7");
  await page.getByRole("button", { name: /import watchlist/i }).click();
  await expect(page.locator(".connection-note")).toContainText("Importing Letterboxd watchlist");
  await page.getByLabel("Movie source").selectOption("plex");
  finishImport();
  await expect(page.getByRole("status")).toHaveText("Connect Plex to use your library.");
  await expect(page.getByText("0 eligible films", { exact: true })).toBeVisible();
});

test("ignores an import after its visible username changes", async ({ page }) => {
  await page.route("**/api/plex/auth/status", route => route.fulfill({ json: { authenticated: false } }));
  let finishRequest!: () => void;
  const requestMayFinish = new Promise<void>(resolve => { finishRequest = resolve; });
  await page.route("**/api/letterboxd/watchlist?username=first-user", async route => {
    await requestMayFinish;
    await route.fulfill({ json: { films: [{ id: "letterboxd-old", title: "Old User Film", genres: [], watched: false }] } });
  });
  await page.goto("/");
  await page.getByLabel("Movie source").selectOption("letterboxd");
  await page.getByLabel("Letterboxd username").fill("first-user");
  await page.getByRole("button", { name: /import watchlist/i }).click();
  await page.getByLabel("Letterboxd username").fill("second-user");
  finishRequest();
  await expect(page.getByText("0 eligible films", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Enter a public Letterboxd username.");
});

test("ignores an import after its visible list URL changes", async ({ page }) => {
  await page.route("**/api/plex/auth/status", route => route.fulfill({ json: { authenticated: false } }));
  let finishRequest!: () => void;
  const requestMayFinish = new Promise<void>(resolve => { finishRequest = resolve; });
  await page.route("**/api/letterboxd/list?**", async route => {
    await requestMayFinish;
    await route.fulfill({ json: { films: [{ id: "letterboxd-old-list", title: "Old List Film", genres: [], watched: false }] } });
  });
  await page.goto("/");
  await page.getByLabel("Movie source").selectOption("letterboxd");
  await page.getByLabel("Letterboxd dataset").selectOption("list");
  await page.getByLabel("Letterboxd list URL").fill("https://letterboxd.com/user/list/first-list/");
  await page.getByRole("button", { name: /import list/i }).click();
  await page.getByLabel("Letterboxd list URL").fill("https://letterboxd.com/user/list/second-list/");
  finishRequest();
  await expect(page.getByText("0 eligible films", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Paste a public Letterboxd list URL.");
});

test("combined Letterboxd import dedupes shared films and marks diary history watched", async ({ page }) => {
  await page.route("**/api/plex/auth/status", route => route.fulfill({ json: { authenticated: false } }));
  await page.route("**/api/letterboxd/watchlist?username=film_fan-7", route => route.fulfill({ json: {
    films: [{ id: "letterboxd-shared", title: "Shared", year: 2020, genres: [], watched: false, source: "letterboxd", externalUrl: "https://letterboxd.com/film/shared/", plexKey: "letterboxd-shared", libraryKey: "letterboxd" }],
  } }));
  await page.route("**/api/letterboxd/diary?username=film_fan-7", route => route.fulfill({ json: {
    films: [
      { id: "letterboxd-shared", title: "Shared", year: 2020, genres: [], watched: true, source: "letterboxd", externalUrl: "https://letterboxd.com/film/shared/", plexKey: "letterboxd-shared", libraryKey: "letterboxd" },
      { id: "letterboxd-diary-only", title: "Diary only", year: 2021, genres: [], watched: true, source: "letterboxd", externalUrl: "https://letterboxd.com/film/diary-only/", plexKey: "letterboxd-diary-only", libraryKey: "letterboxd" },
    ],
  } }));
  await page.goto("/");
  await page.getByLabel("Movie source").selectOption("letterboxd");
  await page.getByLabel("Letterboxd dataset").selectOption("combined");
  await page.getByLabel("Letterboxd username").fill("film_fan-7");
  await page.getByRole("button", { name: /import watchlist \+ diary/i }).click();
  await expect(page.getByText("2 eligible films", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Filters" }).click();
  await page.getByLabel("Watched").selectOption("watched");
  await expect(page.getByText("2 eligible films", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Shared" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Diary only" })).toHaveCount(1);
});
