#!/usr/bin/env node
// CLI entry for `npm run lint:rulesets`.
// Discovers every versioned ruleset under the compliance root and validates it.
// Exits 0 if all pass, 1 if any ruleset has errors.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { lintAll, formatReport } from "./lint.mjs";

const COMPLIANCE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const { ok, results } = lintAll(COMPLIANCE_ROOT);

if (results.length === 0) {
  console.error("lint:rulesets — no rulesets found under", COMPLIANCE_ROOT);
  process.exit(1);
}

console.log(`lint:rulesets — ${results.length} ruleset(s)\n`);
console.log(formatReport(results));

if (ok) {
  console.log(`\n✓ All ${results.length} ruleset(s) valid.`);
  process.exit(0);
} else {
  const failed = results.filter((r) => !r.ok).length;
  console.error(`\n✗ ${failed} of ${results.length} ruleset(s) failed validation.`);
  process.exit(1);
}
