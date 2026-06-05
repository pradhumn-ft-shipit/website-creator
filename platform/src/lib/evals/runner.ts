/**
 * Eval runner core (PRD §8.6) — the pure engine behind `npm run evals`. It
 * evaluates two kinds of golden case, both **offline and deterministic** (no
 * live Gemini call): so the gate runs in CI and catches a regression before any
 * prompt change merges to main (§8.2.8).
 *
 *   - **output-property** cases assert *properties* (never exact text, §8.6) of
 *     a candidate generated output: schema-valid, no prohibited terms, required
 *     disclosures present, footer carries a CRS link, every field has
 *     confidence+sources (§8.2.4).
 *   - **prompt-contract** cases assert a prompt itself carries the §8.2 markers
 *     (rulebook slot, JSON-output instruction, confidence/sources) — so a prompt
 *     edit that drops a principle turns the gate red.
 *
 * A case declares `expect: "pass" | "fail"`. "fail" is a *negative* case: it is
 * `ok` precisely when the bad input IS caught — that's how we test the gate's
 * teeth without leaving the suite permanently red.
 *
 * All inputs are injected via `EvalContext` (prohibited terms, disclosures,
 * prompt-contract rules, the output schema), so the engine is decoupled from
 * the §18.2 baseline and from any specific ruleset version.
 */

import type { OutputSchema } from "@/lib/gemini";

export type CheckName =
  | "schema_valid"
  | "no_prohibited_terms"
  | "required_disclosures_present"
  | "footer_contains_crs_link"
  | "field_confidence_sources"
  | "prompt_contract";

export type EvalKind = "output-property" | "prompt-contract";

export interface DisclosureRule {
  id: string;
  label: string;
  /** `footer_link` → a footer link of `linkKind` must exist; `text` → `pattern` must appear in copy. */
  kind: "footer_link" | "text";
  linkKind?: string;
  /** Regex source string (matched case-insensitively) for `kind: "text"`. */
  pattern?: string;
}

export interface PromptContractRule {
  id: string;
  label: string;
  /** Regex source string (case-insensitive) that must appear in the prompt. */
  pattern: string;
}

export interface EvalContext {
  schema: OutputSchema<unknown>;
  prohibitedTerms: string[];
  requiredDisclosures: DisclosureRule[];
  promptContract: PromptContractRule[];
}

export interface EvalCase {
  name: string;
  kind: EvalKind;
  expect: "pass" | "fail";
  asserts: CheckName[];
  /** output-property cases: the candidate generated output. */
  output?: unknown;
  /** prompt-contract cases: the prompt text to inspect. */
  promptText?: string;
  /** prompt-contract cases: override the contract rules (e.g. validator prompts need fewer markers than generation prompts). */
  contractRules?: PromptContractRule[];
  note?: string;
}

export interface CheckResult {
  check: CheckName;
  passed: boolean;
  detail?: string;
}

export interface EvalResult {
  name: string;
  kind: EvalKind;
  expect: "pass" | "fail";
  /** Did the case meet its expectation? This is what the gate keys on. */
  ok: boolean;
  checks: CheckResult[];
}

export interface EvalReport {
  total: number;
  passed: number;
  failed: number;
  results: EvalResult[];
}

// ---- string collection (shape-aware to v1; see schema.ts) ----

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** A `GeneratedField`-like node: an object with a string `value`. */
function isFieldLike(v: unknown): v is { value: string; confidence?: unknown; sources?: unknown } {
  return isObject(v) && typeof v.value === "string";
}

/** Walk the output and return every field-like node (for content + §8.2.4 checks). */
function collectFields(node: unknown, out: Array<{ path: string; node: Record<string, unknown> }> = [], path = "$"): typeof out {
  if (Array.isArray(node)) {
    node.forEach((v, i) => collectFields(v, out, `${path}[${i}]`));
  } else if (isObject(node)) {
    if (isFieldLike(node)) out.push({ path, node });
    for (const [k, v] of Object.entries(node)) collectFields(v, out, `${path}.${k}`);
  }
  return out;
}

/** Customer-visible copy: every field value plus footer-link labels. */
function collectCopy(output: unknown): string[] {
  const copy = collectFields(output).map((f) => String(f.node.value));
  const links = isObject(output) && isObject(output.footer) ? output.footer.links : undefined;
  if (Array.isArray(links)) {
    for (const l of links) if (isObject(l) && typeof l.label === "string") copy.push(l.label);
  }
  return copy;
}

function footerLinks(output: unknown): Array<Record<string, unknown>> {
  const links = isObject(output) && isObject(output.footer) ? output.footer.links : undefined;
  return Array.isArray(links) ? links.filter(isObject) : [];
}

// ---- the property checks ----

function checkSchemaValid(output: unknown, ctx: EvalContext): CheckResult {
  try {
    ctx.schema.parse(output);
    return { check: "schema_valid", passed: true };
  } catch (err) {
    return { check: "schema_valid", passed: false, detail: (err as Error).message };
  }
}

function checkNoProhibitedTerms(output: unknown, ctx: EvalContext): CheckResult {
  const copy = collectCopy(output).join("\n");
  const found = ctx.prohibitedTerms.filter((term) => {
    // Word-boundary, case-insensitive — so "promise" never matches "compromise".
    const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    return re.test(copy);
  });
  return found.length === 0
    ? { check: "no_prohibited_terms", passed: true }
    : { check: "no_prohibited_terms", passed: false, detail: `found: ${found.join(", ")}` };
}

function checkRequiredDisclosures(output: unknown, ctx: EvalContext): CheckResult {
  const links = footerLinks(output);
  const copy = collectCopy(output).join("\n");
  const missing = ctx.requiredDisclosures.filter((rule) => {
    if (rule.kind === "footer_link") {
      return !links.some((l) => l.kind === rule.linkKind && typeof l.url === "string" && l.url !== "");
    }
    return rule.pattern ? !new RegExp(rule.pattern, "i").test(copy) : false;
  });
  return missing.length === 0
    ? { check: "required_disclosures_present", passed: true }
    : { check: "required_disclosures_present", passed: false, detail: `missing: ${missing.map((m) => m.label).join(", ")}` };
}

function checkFooterCrsLink(output: unknown): CheckResult {
  const hasCrs = footerLinks(output).some((l) => l.kind === "crs" && typeof l.url === "string" && l.url !== "");
  return hasCrs
    ? { check: "footer_contains_crs_link", passed: true }
    : { check: "footer_contains_crs_link", passed: false, detail: "no footer link of kind 'crs' with a url" };
}

function checkFieldConfidenceSources(output: unknown): CheckResult {
  const bad: string[] = [];
  for (const { path, node } of collectFields(output)) {
    const c = node.confidence;
    if (typeof c !== "number" || !Number.isFinite(c) || c < 0 || c > 1) bad.push(`${path}.confidence`);
    if (!Array.isArray(node.sources) || (node.sources as unknown[]).some((s) => typeof s !== "string")) {
      bad.push(`${path}.sources`);
    }
  }
  return bad.length === 0
    ? { check: "field_confidence_sources", passed: true }
    : { check: "field_confidence_sources", passed: false, detail: `invalid: ${bad.join(", ")}` };
}

function checkPromptContract(promptText: string, rules: PromptContractRule[]): CheckResult {
  const text = promptText ?? "";
  const missing = rules.filter((rule) => !new RegExp(rule.pattern, "i").test(text));
  return missing.length === 0
    ? { check: "prompt_contract", passed: true }
    : { check: "prompt_contract", passed: false, detail: `missing markers: ${missing.map((m) => m.id).join(", ")}` };
}

function runCheck(check: CheckName, c: EvalCase, ctx: EvalContext): CheckResult {
  switch (check) {
    case "schema_valid":
      return checkSchemaValid(c.output, ctx);
    case "no_prohibited_terms":
      return checkNoProhibitedTerms(c.output, ctx);
    case "required_disclosures_present":
      return checkRequiredDisclosures(c.output, ctx);
    case "footer_contains_crs_link":
      return checkFooterCrsLink(c.output);
    case "field_confidence_sources":
      return checkFieldConfidenceSources(c.output);
    case "prompt_contract":
      return checkPromptContract(c.promptText ?? "", c.contractRules ?? ctx.promptContract);
  }
}

export function runEval(c: EvalCase, ctx: EvalContext): EvalResult {
  const checks = c.asserts.map((check) => runCheck(check, c, ctx));
  const allPassed = checks.every((r) => r.passed);
  // pass-case: every check must pass. fail-case (negative): at least one must fail.
  const ok = c.expect === "pass" ? allPassed : !allPassed;
  return { name: c.name, kind: c.kind, expect: c.expect, ok, checks };
}

export function runEvals(cases: EvalCase[], ctx: EvalContext): EvalReport {
  const results = cases.map((c) => runEval(c, ctx));
  const passed = results.filter((r) => r.ok).length;
  return { total: results.length, passed, failed: results.length - passed, results };
}

/** Human-readable per-case report for the CLI (`npm run evals`). */
export function formatReport(report: EvalReport): string {
  const lines: string[] = [];
  for (const r of report.results) {
    lines.push(`${r.ok ? "PASS" : "FAIL"}  ${r.name}  [${r.kind}, expect:${r.expect}]`);
    if (!r.ok) {
      for (const c of r.checks.filter((c) => !c.passed)) {
        lines.push(`        ↳ ${c.check}: ${c.detail ?? "failed"}`);
      }
    }
  }
  lines.push("");
  lines.push(`${report.passed}/${report.total} cases passed${report.failed ? `, ${report.failed} FAILED` : ""}`);
  return lines.join("\n");
}
