/**
 * The eval gate (`npm run evals`, PRD §8.6, §8.2.8). Runs every golden case
 * through the pure runner and asserts each meets its expectation, with a
 * per-case pass/fail line and a nonzero exit on any failure (vitest provides
 * both). Kept OUT of `npm test`: it lives under `evals/` (the default config
 * only globs `src/**`) and runs via its own `vitest.evals.config.ts`, so the
 * prompt gate is a distinct CI step from the unit suite.
 */

import { describe, it, expect } from "vitest";

import { runEvals, formatReport } from "@/lib/evals/runner";

import { EVAL_CONTEXT } from "./baseline";
import { buildCases } from "./cases";

const report = runEvals(buildCases(), EVAL_CONTEXT);

// Print the full report so the command reads like an eval report, not just dots.
console.log("\n" + formatReport(report) + "\n");

describe("golden evals (PRD §8.6)", () => {
  for (const r of report.results) {
    it(`${r.name} [${r.kind}, expect:${r.expect}]`, () => {
      const reason = r.checks
        .filter((c) => !c.passed)
        .map((c) => `${c.check}: ${c.detail ?? "failed"}`)
        .join("; ");
      expect(r.ok, reason || "case did not meet its expectation").toBe(true);
    });
  }

  it("ships at least 10 golden cases (§8.2.8)", () => {
    expect(report.total).toBeGreaterThanOrEqual(10);
  });
});
