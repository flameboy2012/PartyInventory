import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Walks the audit trail through the real UI: a player names themselves, changes the party several
 * ways, and reads their own history back. The second test proves another player's change reaches
 * an open feed without a reload.
 */

/** Dialogs render into a portal, so scope by the slot rather than by position. */
const dialogOf = (page: Page) => page.locator('[data-slot="dialog-content"]');

const feedOf = (page: Page) => page.getByRole("region", { name: "History" });

function unique(prefix: string) {
  return `${prefix} ${Date.now().toString(36)}`;
}

async function createParty(page: Page, partyName: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Create party" }).click();

  const dialog = dialogOf(page);
  await dialog.getByLabel("Party name").fill(partyName);
  await dialog.getByRole("button", { name: "Create", exact: true }).click();

  await expect(page).toHaveURL(/\/parties\/[0-9a-f-]+$/);
}

async function nameYourself(page: Page, actorName: string) {
  await expect(page.getByText("Who are you?")).toBeVisible();
  await page.getByLabel("Your name").fill(actorName);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Share code:")).toBeVisible();
}

async function addCharacter(page: Page, name: string) {
  await page.getByRole("button", { name: "Add character" }).click();

  const dialog = dialogOf(page);
  await dialog.getByLabel("Name", { exact: true }).fill(name);
  await dialog.getByRole("button", { name: "Add character" }).click();
  await expect(dialog).toBeHidden();
}

async function addItem(page: Page, name: string) {
  await page.getByRole("button", { name: "Add item", exact: true }).click();

  const dialog = dialogOf(page);
  await dialog.getByLabel("Name", { exact: true }).fill(name);
  await dialog.getByRole("button", { name: "Add item" }).click();
  await expect(dialog).toBeHidden();
}

/** Opens the row menu for an item and picks one of its actions. */
async function itemAction(page: Page, itemName: string, action: "Edit" | "Move" | "Delete") {
  const row = page.getByRole("row").filter({ hasText: itemName });
  await row.getByRole("button", { name: "Item actions" }).click();
  await page.getByRole("menuitem", { name: action }).click();
}

async function setCoins(page: Page, mode: "Add coins" | "Spend coins", gold: number) {
  await page.getByRole("button", { name: mode }).click();

  const dialog = dialogOf(page);
  await dialog.getByLabel("gp").fill(String(gold));
  await dialog.getByRole("button", { name: mode }).click();
  await expect(dialog).toBeHidden();
}

async function entry(page: Page, detail: string): Promise<Locator> {
  return feedOf(page).getByRole("listitem").filter({ hasText: detail });
}

test("records every kind of change, with the actor, and keeps naming a deleted item", async ({
  page,
}) => {
  const partyName = unique("Chronicle");
  await createParty(page, partyName);
  await nameYourself(page, "Scott");

  // The feed starts empty rather than erroring.
  await expect(feedOf(page).getByText("Nothing has changed yet.")).toBeVisible();

  await addCharacter(page, "Thorin");
  await addItem(page, "Longsword");
  await itemAction(page, "Longsword", "Move");
  await dialogOf(page).getByRole("button", { name: "Thorin" }).click();
  await expect(dialogOf(page)).toBeHidden();

  await setCoins(page, "Add coins", 10);
  await setCoins(page, "Spend coins", 3);

  await page.getByRole("button", { name: "Transfer coins" }).click();
  const transfer = dialogOf(page);
  await transfer.getByLabel("To").selectOption({ label: "Thorin" });
  await transfer.getByLabel("gp").fill("2");
  await transfer.getByRole("button", { name: "Transfer" }).click();
  await expect(transfer).toBeHidden();

  // The item now lives on Thorin, so delete it from that tab.
  await page.getByRole("tab", { name: "Thorin" }).click();
  await itemAction(page, "Longsword", "Delete");
  await expect(page.getByRole("row").filter({ hasText: "Longsword" })).toBeHidden();

  for (const detail of [
    "Added Thorin",
    "Added Longsword to the party stash",
    "Moved Longsword from the party stash to Thorin",
    "Set the party stash to 10 gp",
    "Spent 3 gp from the party stash",
    "Transferred 2 gp from the party stash to Thorin",
    "Removed Longsword",
  ]) {
    await expect(await entry(page, detail)).toHaveCount(1);
    // Every change is attributed to the player who made it.
    await expect(await entry(page, detail)).toContainText("Scott");
  }

  // Newest first.
  const details = feedOf(page).getByRole("listitem");
  await expect(details.first()).toContainText("Removed Longsword");
  await expect(details.last()).toContainText("Added Thorin");

  // The history still names the item after it is gone.
  await page.reload();
  await expect(await entry(page, "Removed Longsword")).toContainText("Longsword");
});

test("another player's change reaches an open feed without a reload", async ({ browser }) => {
  const host = await browser.newContext();
  const guest = await browser.newContext();

  try {
    const hostPage = await host.newPage();
    await createParty(hostPage, unique("Shared"));
    await nameYourself(hostPage, "Scott");

    const joinCode = (await hostPage.locator("span.font-mono").first().innerText()).trim();

    // Joining asks for the name inline, so the party page does not ask again.
    const guestPage = await guest.newPage();
    await guestPage.goto("/");
    await guestPage.getByRole("button", { name: "Join party" }).click();
    const joinDialog = dialogOf(guestPage);
    await joinDialog.getByLabel("Share code").fill(joinCode);
    await joinDialog.getByLabel("Your name").fill("Nori");
    await joinDialog.getByRole("button", { name: "Join" }).click();

    await expect(guestPage).toHaveURL(/\/parties\/[0-9a-f-]+$/);
    await expect(guestPage.getByText("Share code:")).toBeVisible();
    await expect(guestPage.getByText("Who are you?")).toBeHidden();

    await addItem(guestPage, "Lantern");

    // The host never reloaded.
    const hostEntry = feedOf(hostPage).getByRole("listitem").filter({ hasText: "Added Lantern" });
    await expect(hostEntry).toBeVisible({ timeout: 15_000 });
    await expect(hostEntry).toContainText("Nori");
  } finally {
    await host.close();
    await guest.close();
  }
});
