import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Load .env.local so the smoke suite (and the dev server it boots) see the
// Supabase env + SMOKE_ADMIN_* credentials. Existing process env wins.
try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = /^([A-Z_0-9]+)=(.*)$/.exec(line.trim());
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }
} catch {
  // no .env.local (e.g. CI) — fine, gated tests skip themselves
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
