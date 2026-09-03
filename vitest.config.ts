import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Loads .env.local inside each worker (see vitest.setup.ts) — code in
    // this config file only runs in the main process and doesn't propagate
    // env mutations to the workers that actually execute tests.
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
