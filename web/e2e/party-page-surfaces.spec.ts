import { expect, test, type Page } from "@playwright/test";

/**
 * The party view swaps primitives at 768px: the holder picker is a sheet below and a popover
 * above, and Add item is a sheet below and a dialog above. This spec opens both surfaces and
 * fails on any uncaught page error, so a primitive that is mounted wrongly at one width is
 * caught at that width rather than in a browser.
 *
 * It asserts on what the player sees rather than on which primitive rendered it, so the same
 * spec is meaningful in both projects.
 */

const dialogOf = (page: Page) => page.locator('[data-slot="dialog-content"]');

test("both pickers open without a page error", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  await page.getByRole("button", { name: "Create party" }).click();
  const dialog = dialogOf(page);
  await dialog.getByLabel("Party name").fill(`Surfaces ${Date.now().toString(36)}`);
  await dialog.getByRole("button", { name: "Create", exact: true }).click();

  await expect(page.getByText("Who are you?")).toBeVisible();
  await page.getByLabel("Your name").fill("Scott");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Share code:")).toBeVisible();

  await page.locator('[data-slot="holder-picker-trigger"]').click();
  await expect(page.getByRole("list", { name: "Holders" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("list", { name: "Holders" })).toBeHidden();

  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Add an item" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Add an item" })).toBeHidden();

  expect(errors).toEqual([]);
});
