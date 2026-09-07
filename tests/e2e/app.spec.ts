import { expect, test } from "@playwright/test";

test("demo wheel, filters, details, and keyboard dismissal work", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /make the decision/i })).toBeVisible();
  await expect(page.getByText("0 eligible films", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /use demo shelf/i }).click();
  await expect(page.getByText("8 eligible films", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Arrival" })).toBeVisible();

  await page.getByRole("button", { name: /^Filters/ }).click();
  await page.getByLabel("Watched").selectOption("unwatched");
  await expect(page.getByText("6 eligible films", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Filters/ }).click();

  await page.getByRole("button", { name: "Arrival" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Arrival" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: /exclude.*spin again/i })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: /close movie details/i })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Arrival" })).toBeFocused();

  await page.getByRole("button", { name: "Spin" }).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 2500 });
  await page.getByRole("button", { name: /exclude.*spin again/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 2500 });

  await page.screenshot({
    path: testInfo.project.name === "mobile" ? ".impeccable/review/mobile.png" : ".impeccable/review/desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(consoleErrors).toEqual([]);
});

test("privacy page is reachable", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy, plainly." })).toBeVisible();
  await expect(page.getByText(/public Letterboxd username/i)).toBeVisible();
});

test("switching sources during a spin cancels the pending result", async ({ page }) => {
  await page.route("**/api/plex/auth/status", route => route.fulfill({ json: { authenticated: false } }));
  await page.goto("/");
  await page.getByRole("button", { name: /use demo shelf/i }).click();
  await page.getByRole("button", { name: "Spin", exact: true }).click();
  await page.getByLabel("Movie source").selectOption("letterboxd");
  await page.waitForTimeout(1_200);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("0 eligible films", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Enter a public Letterboxd username.");
});

test("shows Plex connection progress and errors beside the library controls", async ({ page }) => {
  await page.route("**/api/plex/auth/status", route => route.fulfill({ json: { authenticated: true } }));
  await page.route("**/api/plex/servers", route => route.fulfill({ json: { servers: [{ id: "server-1", machineIdentifier: "server-1", name: "JUANDEI", product: "Plex Media Server", connections: [] }] } }));
  let finishRequest!: () => void;
  const requestMayFinish = new Promise<void>(resolve => { finishRequest = resolve; });
  await page.route("**/api/plex/libraries?**", async route => { await requestMayFinish; await route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "Remote access unavailable.", diagnostics: { destinationClasses: [["ipv4-public"]], attempts: [{ connection: "direct", host: "plex.direct", outcome: "error", error: "unreachable", elapsedMs: 7000 }] } }) }); });
  await page.goto("/");
  await page.getByLabel("Plex server").selectOption("server-1");
  await expect(page.locator(".connection-note")).toContainText("Checking secure Plex routes");
  finishRequest();
  await expect(page.locator(".connection-note")).toContainText("Remote access unavailable.");
  await expect(page.locator(".connection-note")).toContainText("direct/plex.direct: unreachable (7000 ms)");
});

test("clears loading when an in-flight Plex server choice is reset", async ({ page }) => {
  await page.route("**/api/plex/auth/status", route => route.fulfill({ json: { authenticated: true } }));
  await page.route("**/api/plex/servers", route => route.fulfill({ json: { servers: [{ id: "server-1", machineIdentifier: "server-1", name: "JUANDEI", product: "Plex Media Server", connections: [] }] } }));
  let finishLibraries!: () => void;
  const librariesMayFinish = new Promise<void>(resolve => { finishLibraries = resolve; });
  await page.route("**/api/plex/libraries?**", async route => {
    await librariesMayFinish;
    await route.fulfill({ json: { libraries: [{ key: "1", title: "Movies", type: "movie" }] } });
  });
  await page.goto("/");
  await page.getByLabel("Plex server").selectOption("server-1");
  await expect(page.locator(".stage-meta")).toContainText("loading");
  await page.getByLabel("Plex server").selectOption("");
  finishLibraries();
  await expect(page.locator(".stage-meta")).not.toContainText("loading");
  await expect(page.getByRole("status")).toHaveText("Choose a Plex server.");
});

test("ignores a completed Plex movie load after switching sources", async ({ page }) => {
  await page.route("**/api/plex/auth/status", route => route.fulfill({ json: { authenticated: true } }));
  await page.route("**/api/plex/servers", route => route.fulfill({ json: { servers: [{ id: "server-1", machineIdentifier: "server-1", name: "JUANDEI", product: "Plex Media Server", connections: [] }] } }));
  await page.route("**/api/plex/libraries?**", route => route.fulfill({ json: { libraries: [{ key: "1", title: "Movies", type: "movie" }] } }));
  let finishMovies!: () => void;
  const moviesMayFinish = new Promise<void>(resolve => { finishMovies = resolve; });
  await page.route("**/api/plex/movies?**", async route => {
    await moviesMayFinish;
    await route.fulfill({ json: { movies: [{ id: "plex-late", title: "Plex Late", genres: [], watched: false, plexKey: "1", libraryKey: "1" }] } });
  });
  await page.goto("/");
  await page.getByLabel("Plex server").selectOption("server-1");
  await page.getByLabel("Movie library").selectOption("1");
  await page.getByLabel("Movie source").selectOption("letterboxd");
  finishMovies();
  await expect(page.getByRole("status")).toHaveText("Enter a public Letterboxd username.");
  await expect(page.getByText("0 eligible films", { exact: true })).toBeVisible();
});

test("changing Plex libraries during a spin cancels the pending result", async ({ page }) => {
  await page.route("**/api/plex/auth/status", route => route.fulfill({ json: { authenticated: true } }));
  await page.route("**/api/plex/servers", route => route.fulfill({ json: { servers: [{ id: "server-1", machineIdentifier: "server-1", name: "JUANDEI", product: "Plex Media Server", connections: [] }] } }));
  await page.route("**/api/plex/libraries?**", route => route.fulfill({ json: { libraries: [{ key: "1", title: "Movies One", type: "movie" }, { key: "2", title: "Movies Two", type: "movie" }] } }));
  await page.route("**/api/plex/movies?**", route => {
    const library = new URL(route.request().url()).searchParams.get("library");
    return route.fulfill({ json: { movies: [{ id: `plex-${library}`, title: `Plex ${library}`, genres: [], watched: false, plexKey: library, libraryKey: library }] } });
  });
  await page.goto("/");
  await page.getByLabel("Plex server").selectOption("server-1");
  await page.getByLabel("Movie library").selectOption("1");
  await page.getByRole("button", { name: "Spin", exact: true }).click();
  await page.getByLabel("Movie library").selectOption("2");
  await page.waitForTimeout(1_200);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Spin", exact: true })).toBeEnabled();
  await expect(page.getByText("1 eligible film", { exact: true })).toBeVisible();
});

test("resets Plex selectors when switching away and back", async ({ page }) => {
  await page.route("**/api/plex/auth/status", route => route.fulfill({ json: { authenticated: true } }));
  await page.route("**/api/plex/servers", route => route.fulfill({ json: { servers: [{ id: "server-1", machineIdentifier: "server-1", name: "JUANDEI", product: "Plex Media Server", connections: [] }] } }));
  await page.route("**/api/plex/libraries?**", route => route.fulfill({ json: { libraries: [{ key: "1", title: "Movies", type: "movie" }] } }));
  await page.route("**/api/plex/movies?**", route => route.fulfill({ json: { movies: [{ id: "plex-one", title: "Plex One", genres: [], watched: false, plexKey: "1", libraryKey: "1" }] } }));
  await page.goto("/");
  await page.getByLabel("Plex server").selectOption("server-1");
  await page.getByLabel("Movie library").selectOption("1");
  await expect(page.getByText("1 eligible film", { exact: true })).toBeVisible();
  await page.getByLabel("Movie source").selectOption("letterboxd");
  await page.getByLabel("Movie source").selectOption("plex");
  await expect(page.getByLabel("Plex server")).toHaveValue("");
  await expect(page.getByLabel("Movie library")).toHaveValue("");
  await expect(page.getByText("0 eligible films", { exact: true })).toBeVisible();
});
