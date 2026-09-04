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
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
