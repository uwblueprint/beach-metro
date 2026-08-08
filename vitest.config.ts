import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    css: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["lib/**", "app/api/**"],
      exclude: ["**/*.d.ts", "types/**", "lib/maps/index.ts"],
    },
    // Load .env/.env.local into the test process (all vars, no prefix filter) so
    // the integration suite can see SUPABASE_* — it self-skips when they're absent.
    env: loadEnv("", process.cwd(), ""),
    testTimeout: 30_000, // integration tests hit the hosted DB
    // Run test FILES one at a time.
    //
    // The integration suites all point at the same hosted database and genuinely
    // mutate each other's fixtures: creating an issue creates a payout cell for
    // every active captain, so one suite adding a financial year changes what
    // another suite's captain history contains, and a suite deleting a year
    // cascades away issues another suite is mid-way through using. We chased
    // several flakes of exactly that shape before giving up on isolating them
    // assertion by assertion.
    //
    // The unit tests are fast enough that serialising costs little, and it removes
    // the whole class of problem rather than one instance of it. Revisit if CI ever
    // gets its own database, at which point parallel files become safe again.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      // `server-only` throws outside a React Server environment; tests exercise
      // the service layer directly, so alias it to an empty module.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
