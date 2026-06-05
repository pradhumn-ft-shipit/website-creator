import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Dedicated config for the prompt/eval gate (`npm run evals`, PRD §8.6). It
 * globs only `evals/**` so the eval cases run as a SEPARATE CI step from the
 * unit suite (`npm test`, which globs `src/**`). Pure node — no jsdom, no
 * react/jest-dom setup. Shares the `@` alias so eval files import the prompt
 * loader, schema, and runner from `src/`.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["evals/**/*.eval.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
