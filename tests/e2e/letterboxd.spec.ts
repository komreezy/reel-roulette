import { expect, test } from "@playwright/test";

const film = {
  id: "letterboxd-one",
  title: "One",
  year: 2020,
  genres: [],
  watched: false,
  source: "letterboxd",
  externalUrl: "https://letterboxd.com/film/one/",
  plexKey: "letterboxd-one",
  libraryKey: "letterboxd",
};

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("a watchlist opens its selected film and omits unavailable metadata", async ({
  page,
}) => {
  await page.route("**/api/letterboxd/watchlist?username=film_fan-7", (route) =>
    route.fulfill({ json: { films: [film] } }),
  );
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Your Letterboxd username" })
    .fill("film_fan-7");
  await page.getByRole("button", { name: "Load shelf", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Change movie source" }),
  ).toContainText(/1 film/);
  await page.getByRole("button", { name: "Pull a movie", exact: true }).click();
  const result = page.getByRole("region", { name: "Selected movie" });
  await expect(
    result.getByRole("heading", { name: "One", exact: true }),
  ).toBeVisible();
  await expect(result.getByText("2020", { exact: true })).toBeVisible();
  await expect(
    result.getByRole("link", { name: "Open in Letterboxd" }),
  ).toHaveAttribute("href", film.externalUrl);
  await expect(
    result.getByRole("link", { name: "Open in Letterboxd" }),
  ).toHaveAttribute("target", "_blank");
  await expect(
    result.getByText(/unknown|uncategorized|no summary supplied/i),
  ).toHaveCount(0);
  await expect(result.getByText(/\d+ min/)).toHaveCount(0);
  await expect(result.getByRole("definition")).toHaveCount(0);
  await page.getByRole("button", { name: "Pull another", exact: true }).click();
  await expect(
    result.getByRole("heading", { name: "One", exact: true }),
  ).toBeVisible();
});

test("a public list shows the metadata actually supplied by the import", async ({
  page,
}) => {
  const richFilm = {
    ...film,
    title: "A supplied film",
    summary: "A synopsis supplied by the source.",
    runtimeMinutes: 102,
    contentRating: "PG",
    genres: ["Drama", "Mystery"],
    rating: 8.2,
    audienceRating: 8.6,
  };
  await page.route("**/api/letterboxd/list?**", async (route) => {
    expect(new URL(route.request().url()).searchParams.get("url")).toBe(
      "https://letterboxd.com/film_fan-7/list/weekend-picks/",
    );
    await route.fulfill({ json: { films: [richFilm] } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "List URL", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Public Letterboxd list URL" })
    .fill("https://letterboxd.com/film_fan-7/list/weekend-picks/");
  await page.getByRole("button", { name: "Load shelf", exact: true }).click();
  await page.getByRole("button", { name: "Pull a movie", exact: true }).click();
  const result = page.getByRole("region", { name: "Selected movie" });
  await expect(
    result.getByRole("heading", { name: richFilm.title }),
  ).toBeVisible();
  await expect(result.getByText(richFilm.summary)).toBeVisible();
  await expect(result.getByText("102 min", { exact: true })).toBeVisible();
  await expect(result.getByText("PG", { exact: true })).toBeVisible();
  await expect(
    result.getByText("Drama / Mystery", { exact: true }),
  ).toBeVisible();
  await expect(result.getByRole("definition")).toHaveText(["8.2", "8.6"]);
});

for (const kind of ["watchlist", "list"] as const) {
  test(`editing a pending ${kind} import prevents its late response replacing the next collection`, async ({
    page,
  }) => {
    let finishOld!: () => void;
    const oldMayFinish = new Promise<void>((resolve) => {
      finishOld = resolve;
    });
    let oldFinished!: () => void;
    const oldDidFinish = new Promise<void>((resolve) => {
      oldFinished = resolve;
    });
    const oldValue =
      kind === "watchlist"
        ? "old-user"
        : "https://letterboxd.com/user/list/old-list/";
    const newValue =
      kind === "watchlist"
        ? "new-user"
        : "https://letterboxd.com/user/list/new-list/";
    await page.route(`**/api/letterboxd/${kind}?**`, async (route) => {
      const value = new URL(route.request().url()).searchParams.get(
        kind === "watchlist" ? "username" : "url",
      );
      if (value === oldValue) {
        await oldMayFinish;
        await route.fulfill({
          json: {
            films: [{ ...film, id: "late", title: "Late obsolete film" }],
          },
        });
        oldFinished();
      } else {
        await route.fulfill({
          json: { films: [{ ...film, title: "Current collection film" }] },
        });
      }
    });
    await page.goto("/");
    if (kind === "list")
      await page.getByRole("button", { name: "List URL", exact: true }).click();
    const input = page.getByRole("textbox", {
      name:
        kind === "watchlist"
          ? "Your Letterboxd username"
          : "Public Letterboxd list URL",
    });
    await input.fill(oldValue);
    const oldStarted = page.waitForRequest((request) =>
      request.url().includes(`/api/letterboxd/${kind}?`),
    );
    await page.getByRole("button", { name: "Load shelf", exact: true }).click();
    await oldStarted;
    await expect(
      page.getByRole("button", { name: "Importing films" }),
    ).toBeDisabled();
    await input.fill(newValue);
    await page.getByRole("button", { name: "Load shelf", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Pull a movie", exact: true }),
    ).toBeEnabled();
    finishOld();
    await oldDidFinish;
    await page
      .getByRole("button", { name: "Pull a movie", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Selected movie" }).getByRole("heading"),
    ).toHaveText("Current collection film");
    await expect(
      page.getByText("Late obsolete film", { exact: true }),
    ).toHaveCount(0);
  });
}

test("changing source type cancels import while preserving the active collection", async ({
  page,
}) => {
  let finishImport!: () => void;
  const mayFinish = new Promise<void>((resolve) => {
    finishImport = resolve;
  });
  await page.route("**/api/letterboxd/watchlist?**", async (route) => {
    await mayFinish;
    await route.fulfill({ json: { films: [film] } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore the demo shelf" }).click();
  await page.getByRole("button", { name: "Change movie source" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Your Letterboxd username" })
    .fill("pending-user");
  const started = page.waitForRequest((request) =>
    request.url().includes("/api/letterboxd/watchlist?"),
  );
  await dialog.getByRole("button", { name: "Load shelf", exact: true }).click();
  await started;
  await dialog.getByRole("button", { name: "List URL", exact: true }).click();
  finishImport();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Pull a movie", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Selected movie" }).getByRole("heading"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Change movie source" }),
  ).toContainText("8 films");
  await expect(
    page.getByText("From the demo shelf", { exact: true }),
  ).toBeVisible();
});

test("empty collections provide a way back without enabling a draw", async ({
  page,
}) => {
  await page.route("**/api/letterboxd/watchlist?**", (route) =>
    route.fulfill({ json: { films: [] } }),
  );
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Your Letterboxd username" })
    .fill("empty");
  await page.getByRole("button", { name: "Load shelf", exact: true }).click();
  await expect(
    page.getByText(
      "This list is empty. Try another public watchlist or list.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pull a movie", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Choose another list" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("an import failure is visible and a replacement failure keeps the previous shelf", async ({
  page,
}) => {
  await page.route("**/api/letterboxd/watchlist?**", (route) =>
    route.fulfill({
      status: 502,
      json: { error: "Letterboxd could not be reached right now." },
    }),
  );
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Your Letterboxd username" })
    .fill("unavailable");
  await page.getByRole("button", { name: "Load shelf", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Letterboxd could not be reached right now.",
  );
  await expect(
    page.getByRole("button", { name: "Load shelf", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Explore the demo shelf" }).click();
  await page.getByRole("button", { name: "Change movie source" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Load shelf", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(
    "Letterboxd could not be reached right now.",
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Change movie source" }),
  ).toContainText("8 films");
  await expect(
    page.getByRole("button", { name: "Pull a movie", exact: true }),
  ).toBeEnabled();
});
