import { defineConfig, devices } from "@playwright/test";

/**
 * Locale × viewport matrix (QUALITY_PLAN §4): he/en/ru on desktop and mobile. Runs against a
 * running stack (`pnpm dev:services`, web, worker, geometry) seeded with `pnpm db:seed`.
 * Projects run one after another because the order-loop spec shares seeded staff accounts.
 */
const LOCALES = ["he", "en", "ru"] as const;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.ts",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: { executablePath },
  },
  projects: LOCALES.flatMap((locale) => [
    {
      name: `${locale}-desktop`,
      use: { ...devices["Desktop Chrome"], locale, viewport: { width: 1366, height: 900 } },
      metadata: { locale },
    },
    { name: `${locale}-mobile`, use: { ...devices["Pixel 7"], locale }, metadata: { locale } },
  ]),
});
