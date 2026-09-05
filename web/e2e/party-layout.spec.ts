import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * The measurable half of task 10.3: no sideways scrolling, 44px touch targets, a holder picker
 * that does not grow with the party, and rarity colours that clear 4.5:1. These were previously
 * argued from the source; here a real browser measures them.
 *
 * What is deliberately not here: swipe-to-dismiss, backdrop press and software-keyboard
 * behaviour. Those are gestures on real hardware, not measurements.
 */

const TOUCH_TARGET = 44;
// Layout maths lands a hair under a whole pixel often enough that an exact 44 is noise, not signal.
const EPSILON = 0.5;

const dialogOf = (page: Page) => page.locator('[data-slot="dialog-content"]');
const addSurfaceOf = (page: Page) =>
  page.locator('[data-slot="dialog-content"], [data-slot="sheet-content"]');

const isPhone = (viewport: { width: number } | null) => (viewport?.width ?? 0) < 768;

function unique(prefix: string) {
  return `${prefix} ${Date.now().toString(36)}`;
}

async function openParty(page: Page, partyName: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Create party" }).click();
  const dialog = dialogOf(page);
  await dialog.getByLabel("Party name").fill(partyName);
  await dialog.getByRole("button", { name: "Create", exact: true }).click();

  await expect(page.getByText("Who are you?")).toBeVisible();
  await page.getByLabel("Your name").fill("Scott");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Share code:")).toBeVisible();
}

async function addItem(page: Page, name: string, rarity?: string) {
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  const surface = addSurfaceOf(page);
  await surface.getByLabel("Name", { exact: true }).fill(name);

  if (rarity) {
    await surface.getByLabel("Rarity").click();
    await page.getByRole("option", { name: rarity, exact: true }).click();
  }

  await surface.getByRole("button", { name: "Add item" }).click();
  await expect(surface).toBeHidden();
}

async function addCharacter(page: Page, name: string) {
  await page.locator('[data-slot="holder-picker-trigger"]').click();
  await page.getByRole("button", { name: "Add character" }).click();
  const dialog = dialogOf(page);
  await dialog.getByLabel("Name", { exact: true }).fill(name);
  await dialog.getByRole("button", { name: "Add character" }).click();
  await expect(dialog).toBeHidden();
}

/** True when the document itself scrolls sideways — the thing a player actually notices. */
async function scrollsSideways(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    return root.scrollWidth > root.clientWidth;
  });
}

type UndersizedControl = { label: string; width: number; height: number };

/**
 * Dialogs animate in from `scale(0.95)` and sheets slide up, and `toBeVisible()` resolves while
 * that is still running — measuring then reports 41.8px for a 44px control. Wait for the box to
 * stop moving instead of guessing a duration.
 */
async function settled(target: Locator) {
  let previous = -1;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const box = await target.boundingBox();
    const height = box?.height ?? 0;
    if (height > 0 && height === previous) return;
    previous = height;
    await target.page().waitForTimeout(25);
  }
  throw new Error("The surface never stopped animating.");
}

/**
 * Every visible interactive control inside `root`, measured against the 44px rule. A checkbox is
 * measured by its `::after` hit area rather than its box: the design draws a 20px box and extends
 * the target around it, so measuring the element would report a failure a finger never feels.
 */
async function undersizedControls(root: Locator): Promise<UndersizedControl[]> {
  return root.evaluate((node, minimum) => {
    const SELECTOR =
      'button, a[href], input, select, textarea, [role="button"], [role="checkbox"], [role="combobox"], [role="option"], [role="tab"], [role="switch"]';

    const describe = (element: Element) => {
      const text = (element.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
      const label = element.getAttribute("aria-label") ?? text;
      return `${element.tagName.toLowerCase()}${label ? ` "${label}"` : ""}`;
    };

    const results: { label: string; width: number; height: number }[] = [];

    for (const element of Array.from(node.querySelectorAll(SELECTOR))) {
      if (element.closest("[aria-hidden='true']")) continue;

      const styles = getComputedStyle(element);
      if (styles.visibility === "hidden" || styles.display === "none") continue;

      const rect = element.getBoundingClientRect();
      // A zero-size element is a hidden input or a primitive's proxy control, not a target.
      if (rect.width === 0 || rect.height === 0) continue;

      let { width, height } = rect;

      if (element.matches('[data-slot="checkbox"]')) {
        const after = getComputedStyle(element, "::after");
        const left = Number.parseFloat(after.left);
        const right = Number.parseFloat(after.right);
        const top = Number.parseFloat(after.top);
        const bottom = Number.parseFloat(after.bottom);
        if ([left, right, top, bottom].every(Number.isFinite)) {
          width = rect.width - left - right;
          height = rect.height - top - bottom;
        }
      }

      if (Math.min(width, height) < minimum) {
        results.push({ label: describe(element), width, height });
      }
    }

    return results;
  }, TOUCH_TARGET - EPSILON);
}

test("the page does not scroll sideways with a long item name", async ({ page }) => {
  await openParty(page, unique("Layout"));
  await addItem(page, "Greatsword of the Everlasting Dawnbringer Ninefold Vigil");

  expect(await scrollsSideways(page)).toBe(false);

  // The expanded row carries the widest content: a detail grid and three action buttons.
  await page.locator('[aria-label="Items"] button[aria-expanded]').first().click();
  expect(await scrollsSideways(page)).toBe(false);

  await page.getByRole("tab", { name: "History" }).click();
  await expect(page.getByRole("region", { name: "History" })).toBeVisible();
  expect(await scrollsSideways(page)).toBe(false);
});

test("the holder picker does not grow with the party", async ({ page, viewport }) => {
  await openParty(page, unique("Eight"));

  const trigger = page.locator('[data-slot="holder-picker-trigger"]');
  const before = await trigger.boundingBox();

  for (const name of ["Thorin", "Nori", "Dori", "Ori", "Balin", "Dwalin", "Bifur", "Bofur"]) {
    await addCharacter(page, name);
  }

  await expect(page.getByRole("list", { name: "Holders" })).toBeHidden();
  const after = await trigger.boundingBox();

  expect(after?.width).toBeCloseTo(before?.width ?? 0, 0);
  expect(after?.height).toBeCloseTo(before?.height ?? 0, 0);
  expect(await scrollsSideways(page)).toBe(false);

  // Every holder stays reachable: the list scrolls inside its own container.
  await trigger.click();
  const holders = page.getByRole("list", { name: "Holders" });
  await expect(holders.getByRole("listitem")).toHaveCount(9);
  await expect(holders.getByRole("button", { name: "Bofur" })).toBeVisible();
  expect(await scrollsSideways(page)).toBe(false);

  if (isPhone(viewport)) {
    expect(await undersizedControls(holders)).toEqual([]);
  }
});

test("rarity colours clear 4.5:1 against what they sit on", async ({ page }) => {
  await openParty(page, unique("Rarity"));

  for (const [name, rarity] of [
    ["Cloak", "Uncommon"],
    ["Wand", "Rare"],
    ["Staff", "Very rare"],
    ["Blade", "Legendary"],
    ["Crown", "Artifact"],
  ]) {
    await addItem(page, name, rarity);
  }

  const failures = await page.locator('[aria-label="Items"]').evaluate((node) => {
    // The tokens are `oklch()` and the tag backgrounds are `color-mix()`, both of which a
    // computed style reports verbatim. Painting one pixel is what converts them to sRGB.
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;

    const parse = (value: string): [number, number, number, number] => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a / 255];
    };

    const over = (
      top: [number, number, number, number],
      bottom: [number, number, number],
    ): [number, number, number] => [
      top[3] * top[0] + (1 - top[3]) * bottom[0],
      top[3] * top[1] + (1 - top[3]) * bottom[1],
      top[3] * top[2] + (1 - top[3]) * bottom[2],
    ];

    // The tag's background is a 12% mix over whatever it sits on, so composite the stack.
    const backgroundOf = (element: Element): [number, number, number] => {
      const layers: [number, number, number, number][] = [];
      let node: Element | null = element;
      while (node) {
        const colour = parse(getComputedStyle(node).backgroundColor);
        if (colour[3] > 0) layers.push(colour);
        if (colour[3] === 1) break;
        node = node.parentElement;
      }
      return layers.reduceRight<[number, number, number]>(
        (beneath, layer) => over(layer, beneath),
        [255, 255, 255],
      );
    };

    const luminance = ([r, g, b]: [number, number, number]) => {
      const channel = (value: number) => {
        const c = value / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };

    const results: { rarity: string; ratio: number }[] = [];

    for (const tag of Array.from(node.querySelectorAll("span"))) {
      const label = (tag.textContent ?? "").trim();
      if (!["Uncommon", "Rare", "Very rare", "Legendary", "Artifact"].includes(label)) continue;

      // The text sits on the tag's own background, which is itself a mix over its ancestors.
      const background = backgroundOf(tag);
      const foreground = over(parse(getComputedStyle(tag).color), background);
      const [lighter, darker] = [luminance(foreground), luminance(background)].sort(
        (a, b) => b - a,
      );
      results.push({ rarity: label, ratio: (lighter + 0.05) / (darker + 0.05) });
    }

    return results
      .filter((result) => result.ratio < 4.5)
      .map((result) => `${result.rarity}: ${result.ratio.toFixed(2)}:1`);
  });

  expect(failures).toEqual([]);
});

test("every interactive control is a 44px target", async ({ page, viewport }) => {
  test.skip(!isPhone(viewport), "The 44px rule applies below the md breakpoint.");

  await openParty(page, unique("Targets"));
  await addCharacter(page, "Thorin");
  await page
    .locator('[data-slot="holder-picker-trigger"]')
    .click()
    .then(() => page.getByRole("list", { name: "Holders" }).getByRole("button", { name: "Party stash" }).click());
  await addItem(page, "Longsword");

  const view = page.locator("body");

  expect(await undersizedControls(view), "the inventory tab").toEqual([]);

  // Each surface is opened, measured, and closed, so one sweep covers the whole view.
  const sweep = async (name: string, open: () => Promise<void>, target: Locator) => {
    await open();
    await expect(target).toBeVisible();
    await settled(target);
    expect(await undersizedControls(target), name).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(target).toBeHidden();
  };

  await sweep(
    "the add item sheet",
    () => page.getByRole("button", { name: "Add item", exact: true }).click(),
    addSurfaceOf(page),
  );

  const row = page.locator('[aria-label="Items"] > li').first();
  await row.locator("button[aria-expanded]").click();
  expect(await undersizedControls(row), "an expanded item row").toEqual([]);

  await sweep("the edit dialog", () => row.getByRole("button", { name: "Edit" }).click(), dialogOf(page));
  await sweep("the give dialog", () => row.getByRole("button", { name: "Give to…" }).click(), dialogOf(page));
  await sweep(
    "the delete confirmation",
    () => row.getByRole("button", { name: "Delete Longsword" }).click(),
    dialogOf(page),
  );
  await sweep(
    "the add coins dialog",
    () => page.getByRole("button", { name: "Add", exact: true }).click(),
    dialogOf(page),
  );
  await sweep(
    "the transfer dialog",
    () => page.getByRole("button", { name: "Send", exact: true }).click(),
    dialogOf(page),
  );

  await page.getByRole("tab", { name: "History" }).click();
  await expect(page.getByRole("region", { name: "History" })).toBeVisible();
  expect(await undersizedControls(view), "the history tab").toEqual([]);
});
