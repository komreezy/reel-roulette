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
  await expect(page.getByRole("heading", { name: /privacy/i })).toBeVisible();
});
