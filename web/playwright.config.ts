import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against the full Docker stack (web + API + Postgres), not a standalone
 * Next.js server, because they exercise the BFF proxy and the API's audit trail together.
 *
 *   npm run dev        # from the repo root, then wait for the stack
 *   npm run test:e2e   # from web/
 */
export default defineConfig({
  testDir: "./e2e",
  // The tests share one database, and the realtime test needs two browsers on one party.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  // The party view swaps primitives at 768px — sheet below, dialog or popover above — so the
  // whole suite runs at both widths. A desktop-only run misses every sheet path.
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "phone",
      // A narrow window rather than a device profile: this is the breakpoint under test, and
      // emulating touch would change how Playwright drives every control as well.
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
  ],
});
