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
    // Load .env/.env.local into the test process (all vars, no prefix filter) so
    // the integration suite can see SUPABASE_* — it self-skips when they're absent.
    env: loadEnv("", process.cwd(), ""),
    testTimeout: 30_000, // integration tests hit the hosted DB
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
