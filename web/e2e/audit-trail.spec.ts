import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Walks the audit trail through the real UI: a player names themselves, changes the party several
 * ways, and reads their own history back. The second test proves another player's change reaches
 * an open feed without a reload.
 */

/** Dialogs render into a portal, so scope by the slot rather than by position. */
const dialogOf = (page: Page) => page.locator('[data-slot="dialog-content"]');

/** Add item is the one surface that swaps primitive at the breakpoint: sheet below `md`. */
const addSurfaceOf = (page: Page) =>
  page.locator('[data-slot="dialog-content"], [data-slot="sheet-content"]');

const feedOf = (page: Page) => page.getByRole("region", { name: "History" });

/** The inventory list, so item rows are never confused with history entries. */
const itemsOf = (page: Page) => page.getByRole("list", { name: "Items" });

const itemRow = (page: Page, itemName: string) =>
  itemsOf(page).getByRole("listitem").filter({ hasText: itemName });

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

/** Inventory and history are two tabs now, so a test says which one it is reading. */
async function showTab(page: Page, tab: "Inventory" | "History") {
  await page.getByRole("tab", { name: tab }).click();
}

/** Opens the holder picker and chooses a holder by name. */
async function selectHolder(page: Page, holderName: string) {
  await page.locator('[data-slot="holder-picker-trigger"]').click();
  await page
    .getByRole("list", { name: "Holders" })
    .getByRole("button", { name: holderName })
    .click();
  await expect(page.locator('[data-slot="holder-picker-trigger"]')).toContainText(holderName);
}

/** Adding a character lives inside the holder picker. */
async function addCharacter(page: Page, name: string) {
  await page.locator('[data-slot="holder-picker-trigger"]').click();
  await page.getByRole("button", { name: "Add character" }).click();

  const dialog = dialogOf(page);
  await dialog.getByLabel("Name", { exact: true }).fill(name);
  await dialog.getByRole("button", { name: "Add character" }).click();
  await expect(dialog).toBeHidden();
}

async function addItem(page: Page, name: string) {
  await page.getByRole("button", { name: "Add item", exact: true }).click();

  const surface = addSurfaceOf(page);
  await surface.getByLabel("Name", { exact: true }).fill(name);
  await surface.getByRole("button", { name: "Add item" }).click();
  await expect(surface).toBeHidden();
}

/** Opens an item row if it isn't open already. The toggle is the row's only `aria-expanded`. */
async function openItem(page: Page, itemName: string): Promise<Locator> {
  const row = itemRow(page, itemName);
  const toggle = row.locator("button[aria-expanded]");
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  return row;
}

/** Opens an item row and picks one of the actions inside it — there is no overflow menu now. */
async function itemAction(page: Page, itemName: string, action: "Give to…" | "Edit" | "Delete") {
  const row = await openItem(page, itemName);
  const name = action === "Delete" ? `Delete ${itemName}` : action;
  await row.getByRole("button", { name }).click();
}

async function setCoins(page: Page, mode: "Add" | "Spend", gold: number) {
  await page.getByRole("button", { name: mode, exact: true }).click();

  const dialog = dialogOf(page);
  await dialog.getByLabel("gp").fill(String(gold));
  await dialog.getByRole("button", { name: `${mode} coins` }).click();
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
  await showTab(page, "History");
  await expect(feedOf(page).getByText("Nothing has changed yet.")).toBeVisible();
  await showTab(page, "Inventory");

  await addCharacter(page, "Thorin");
  // Adding a character selects it, so come back to the stash before adding to the stash.
  await selectHolder(page, "Party stash");
  await addItem(page, "Longsword");
  await itemAction(page, "Longsword", "Give to…");
  await dialogOf(page).getByRole("button", { name: "Thorin" }).click();
  await expect(dialogOf(page)).toBeHidden();

  await setCoins(page, "Add", 10);
  await setCoins(page, "Spend", 3);

  await page.getByRole("button", { name: "Send", exact: true }).click();
  const transfer = dialogOf(page);
  await transfer.getByLabel("To").selectOption({ label: "Thorin" });
  await transfer.getByLabel("gp").fill("2");
  await transfer.getByRole("button", { name: "Transfer" }).click();
  await expect(transfer).toBeHidden();

  // The item now lives on Thorin, so delete it from that holder.
  await selectHolder(page, "Thorin");
  await itemAction(page, "Longsword", "Delete");
  await dialogOf(page).getByRole("button", { name: "Delete", exact: true }).click();
  await expect(itemRow(page, "Longsword")).toBeHidden();

  await showTab(page, "History");
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

  // The history still names the item after it is gone. The tab is in the address, so the reload
  // comes back to the feed.
  await page.reload();
  await expect(page).toHaveURL(/\?tab=history$/);
  await expect(await entry(page, "Removed Longsword")).toContainText("Longsword");
});

test("another player's change reaches an open feed without a reload", async ({
  browser,
  viewport,
}) => {
  // These contexts are built by hand, so they need the project's width passed to them.
  const host = await browser.newContext({ viewport });
  const guest = await browser.newContext({ viewport });

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

    // The host sits on the feed while the guest changes the party.
    await showTab(hostPage, "History");
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

test("an item row opens to show its details and actions", async ({ page }) => {
  await createParty(page, unique("Rows"));
  await nameYourself(page, "Scott");

  await addItem(page, "Longsword");
  await addItem(page, "Rope");

  const longsword = itemRow(page, "Longsword");
  const rope = itemRow(page, "Rope");

  // Collapsed, the row already reads name, rarity, type, value and quantity.
  await expect(longsword).toContainText("Common");
  await expect(longsword).toContainText("Gear");

  await openItem(page, "Longsword");
  await expect(longsword).toContainText("Weight");
  await expect(longsword).toContainText("Equipped");
  await expect(longsword.getByRole("button", { name: "Give to…" })).toBeVisible();
  await expect(longsword.getByRole("button", { name: "Edit" })).toBeVisible();

  // Opening a second row closes the first, so at most one is ever open.
  await openItem(page, "Rope");
  await expect(rope.getByRole("button", { name: "Edit" })).toBeVisible();
  await expect(longsword.getByRole("button", { name: "Edit" })).toBeHidden();
});

test("deleting an item is confirmed, and abandoning it leaves the item alone", async ({ page }) => {
  await createParty(page, unique("Deletes"));
  await nameYourself(page, "Scott");

  await addItem(page, "Longsword");

  // A single press opens the confirmation and deletes nothing.
  await itemAction(page, "Longsword", "Delete");
  const confirm = dialogOf(page);
  await expect(confirm).toContainText("Delete Longsword?");
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toBeHidden();
  await expect(itemRow(page, "Longsword")).toBeVisible();

  // Confirming deletes it.
  await itemAction(page, "Longsword", "Delete");
  await dialogOf(page).getByRole("button", { name: "Delete", exact: true }).click();
  await expect(itemRow(page, "Longsword")).toBeHidden();
});

test("the holder picker switches inventories and selects a character it adds", async ({ page }) => {
  await createParty(page, unique("Holders"));
  await nameYourself(page, "Scott");

  await addItem(page, "Longsword");

  const picker = page.locator('[data-slot="holder-picker-trigger"]');
  await expect(picker).toContainText("Party stash");
  await expect(picker).toContainText("1 item");

  // A character added from inside the picker becomes the selected holder, with nothing in it yet.
  await addCharacter(page, "Thorin");
  await expect(picker).toContainText("Thorin");
  await expect(page.getByText("No items here yet.")).toBeVisible();

  await selectHolder(page, "Party stash");
  await expect(itemRow(page, "Longsword")).toBeVisible();
});

test("a pasted history address opens on the history", async ({ page }) => {
  await createParty(page, unique("Deep link"));
  await nameYourself(page, "Scott");
  await addItem(page, "Longsword");

  const url = page.url();
  await page.goto(`${url}?tab=history`);
  await expect(await entry(page, "Added Longsword to the party stash")).toHaveCount(1);

  // Anything unrecognised falls back to the inventory rather than erroring.
  await page.goto(`${url}?tab=nonsense`);
  await expect(itemRow(page, "Longsword")).toBeVisible();
});
