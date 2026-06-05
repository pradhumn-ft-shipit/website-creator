/**
 * Layer-2 compliance validator (PRD §5.2) — the automated gate that scans
 * generated copy for prohibited terms and missing required elements. This is
 * the "never ship copy that hasn't passed Layer 2" guardrail in code.
 *
 * It is a **hybrid** by design, and the two passes are independent so a single
 * prompt regression can't disable the check (ticket note):
 *
 *   1. **Deterministic pass (always runs, authoritative).** Word-boundary scan
 *      for context-free prohibited terms + required-element/disclosure presence.
 *      Free, fast, offline-testable, immune to prompt drift. This is the gate's
 *      teeth and covers the ticket's acceptance criteria.
 *   2. **AI semantic pass (Gemini Flash, additive).** Catches what regex can't —
 *      the semantic `prohibited_content` categories and context-dependent
 *      superlatives (only flagged when used as an unsubstantiated claim). It can
 *      only ADD violations; it never removes a deterministic one. Skipped (and
 *      surfaced via `aiPassRan:false`) when no client is supplied, so missing
 *      semantic coverage is never silently treated as a pass.
 *
 * Reusable across surfaces via `ValidationSubject`: full-site generation (020),
 * post-launch edit chat (029), and blog posts (031). Required-element checks run
 * only for `kind:"site"` — a blog fragment isn't expected to carry the footer.
 */

import type { OutputSchema } from "@/lib/gemini";
import type { GenerateJSONOptions, GenerateJSONResult } from "@/lib/gemini";

import {
  type ResolvedRuleset,
  type Severity,
} from "./ruleset";

export type ViolationSource = "deterministic" | "ai";

/** One compliance violation. Maps 1:1 onto a `compliance_violations` row. */
export interface Violation {
  ruleId: string;
  severity: Severity;
  /** Where it was found: a content path, "footer.links", or null (fragment/AI). */
  fieldPath: string | null;
  description: string;
  source: ViolationSource;
}

/** What gets validated. A site checks required elements; a fragment does not. */
export type ValidationSubject =
  | { kind: "site"; site: unknown }
  | { kind: "fragment"; text: string; label?: string };

export interface Layer2Result {
  verdict: "pass" | "fail";
  violations: Violation[];
  /** The ruleset version this verdict was produced against (recorded on consumers). */
  rulesetVersion: string;
  /** Did the AI semantic pass run? False when no client was supplied. */
  aiPassRan: boolean;
}

// ---- AI verdict schema (matches prompts/v1/layer2-validate.md output contract) ----

interface Layer2VerdictItem {
  rule_id: string;
  severity: string;
  excerpt: string;
  explanation: string;
}

export interface Layer2Verdict {
  verdict: "pass" | "fail";
  violations: Layer2VerdictItem[];
}

const SEVERITIES: ReadonlySet<string> = new Set(["low", "medium", "high"]);
function coerceSeverity(v: unknown): Severity {
  return typeof v === "string" && SEVERITIES.has(v) ? (v as Severity) : "medium";
}

function parseVerdict(value: unknown): Layer2Verdict {
  if (typeof value !== "object" || value === null) {
    throw new Error("verdict: must be an object");
  }
  const v = value as Record<string, unknown>;
  if (v.verdict !== "pass" && v.verdict !== "fail") {
    throw new Error('verdict.verdict: must be "pass" or "fail"');
  }
  const rawViolations = Array.isArray(v.violations) ? v.violations : [];
  const violations: Layer2VerdictItem[] = rawViolations.map((item, i) => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`verdict.violations[${i}]: must be an object`);
    }
    const it = item as Record<string, unknown>;
    return {
      rule_id: typeof it.rule_id === "string" ? it.rule_id : "unspecified",
      severity: typeof it.severity === "string" ? it.severity : "medium",
      excerpt: typeof it.excerpt === "string" ? it.excerpt : "",
      explanation: typeof it.explanation === "string" ? it.explanation : "",
    };
  });
  return { verdict: v.verdict, violations };
}

/** The Layer-2 verdict schema passed to `gemini.generateJSON`. */
export const LAYER2_VERDICT_SCHEMA: OutputSchema<Layer2Verdict> = {
  jsonSchema: {
    type: "object",
    required: ["verdict"],
    properties: {
      verdict: { type: "string", enum: ["pass", "fail"] },
      violations: {
        type: "array",
        items: {
          type: "object",
          required: ["rule_id", "severity", "excerpt", "explanation"],
          properties: {
            rule_id: { type: "string" },
            severity: { type: "string", enum: ["low", "medium", "high"] },
            excerpt: { type: "string" },
            explanation: { type: "string" },
          },
        },
      },
    },
  },
  parse: parseVerdict,
};

// ---- content extraction (pure) ----

interface CopyNode {
  path: string;
  text: string;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Walk a generated-site object and collect every `{value:string}` field with its path. */
function collectFields(node: unknown, out: CopyNode[] = [], path = "$"): CopyNode[] {
  if (Array.isArray(node)) {
    node.forEach((v, i) => collectFields(v, out, `${path}[${i}]`));
  } else if (isObject(node)) {
    if (typeof node.value === "string") out.push({ path: path.replace(/^\$\./, ""), text: node.value });
    for (const [k, v] of Object.entries(node)) {
      if (k === "value") continue;
      collectFields(v, out, `${path}.${k}`);
    }
  }
  return out;
}

/** Footer link `{kind,url}` pairs (site only). */
function footerLinks(site: unknown): Array<{ kind: string; url: string }> {
  const links = isObject(site) && isObject(site.footer) ? site.footer.links : undefined;
  if (!Array.isArray(links)) return [];
  return links
    .filter(isObject)
    .map((l) => ({ kind: typeof l.kind === "string" ? l.kind : "", url: typeof l.url === "string" ? l.url : "" }));
}

/** Customer-visible copy of a subject: field values (site) + footer-link labels, or the fragment text. */
function subjectCopy(subject: ValidationSubject): CopyNode[] {
  if (subject.kind === "fragment") {
    return [{ path: subject.label ?? "$", text: subject.text }];
  }
  const nodes = collectFields(subject.site);
  for (const l of footerLinks(subject.site)) {
    // labels aren't field-like; nothing to add. (links carry kind/url, not value)
    void l;
  }
  return nodes;
}

function truncate(s: string, n = 80): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > n ? `${flat.slice(0, n)}…` : flat;
}

// ---- deterministic checks (pure) ----

function termRegex(term: string): RegExp {
  // Word-boundary, case-insensitive — so "promise" never matches "compromise".
  return new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
}

/** Scan copy for context-free prohibited terms (the `requiresSubstantiation:false` groups). */
function scanProhibitedTerms(copy: CopyNode[], ruleset: ResolvedRuleset): Violation[] {
  const hardGroups = ruleset.rules.prohibitedTerms.filter((g) => !g.requiresSubstantiation);
  const violations: Violation[] = [];
  for (const node of copy) {
    for (const group of hardGroups) {
      const matched = group.terms.filter((t) => termRegex(t).test(node.text));
      if (matched.length) {
        violations.push({
          ruleId: group.id,
          severity: group.severity,
          fieldPath: node.path,
          description: `Prohibited term${matched.length > 1 ? "s" : ""} "${matched.join(", ")}" in copy: "${truncate(node.text)}"`,
          source: "deterministic",
        });
      }
    }
  }
  return violations;
}

/** Check required footer-link elements are present with a URL (site scope). */
function checkRequiredElements(site: unknown, ruleset: ResolvedRuleset): Violation[] {
  const links = footerLinks(site);
  const violations: Violation[] = [];
  for (const el of ruleset.rules.requiredElements) {
    if (!el.placement.includes("footer")) continue;
    const present = links.some((l) => l.kind === el.linkKind && l.url !== "");
    if (!present) {
      violations.push({
        ruleId: el.id,
        severity: "high",
        fieldPath: "footer.links",
        description: `Missing required element: ${el.label} (footer link of kind "${el.linkKind}")`,
        source: "deterministic",
      });
    }
  }
  return violations;
}

/** Check required disclosure language is present somewhere in the copy (site scope). */
function checkRequiredDisclosures(copy: CopyNode[], ruleset: ResolvedRuleset): Violation[] {
  const haystack = copy.map((c) => c.text).join("\n").toLowerCase();
  const violations: Violation[] = [];
  for (const d of ruleset.rules.requiredDisclosures) {
    if (!haystack.includes(d.textPattern.toLowerCase())) {
      violations.push({
        ruleId: d.id,
        severity: "high",
        fieldPath: "footer",
        description: `Missing required disclosure: ${d.label}`,
        source: "deterministic",
      });
    }
  }
  return violations;
}

/**
 * The deterministic pass. Always runs prohibited-term scanning; required
 * element/disclosure presence is checked only for a full site (a fragment is
 * not the footer, so it must not be failed for "missing CRS link").
 */
export function validateDeterministic(
  subject: ValidationSubject,
  ruleset: ResolvedRuleset,
): Violation[] {
  const copy = subjectCopy(subject);
  const violations = scanProhibitedTerms(copy, ruleset);
  if (subject.kind === "site") {
    violations.push(...checkRequiredElements(subject.site, ruleset));
    violations.push(...checkRequiredDisclosures(copy, ruleset));
  }
  return violations;
}

// ---- AI pass (IO via injected client) ----

/** Minimal structural slice of `GeminiClient` the AI pass needs (real client satisfies it). */
export interface Layer2Gemini {
  generateJSON<T>(opts: GenerateJSONOptions<T>): Promise<GenerateJSONResult<T>>;
}

/** The copy block handed to the Flash validator as the subject under review. */
function buildSubjectPrompt(subject: ValidationSubject): string {
  if (subject.kind === "fragment") {
    return `Review this copy for compliance violations:\n\n${subject.text}`;
  }
  const copy = subjectCopy(subject);
  const block = copy.map((c) => `[${c.path}] ${c.text}`).join("\n");
  return `Review this generated site's copy for compliance violations. Each line is a content field:\n\n${block}`;
}

/** Fill {{compliance_ruleset}} in the layer2 prompt template (fail-loud on a missing slot). */
function buildSystemInstruction(promptText: string, ruleset: ResolvedRuleset): string {
  if (!promptText.includes("{{compliance_ruleset}}")) {
    // The rulebook MUST ride in the system prompt (§8.2.2); refuse to run a pass
    // whose template lost the slot rather than validate against an empty ruleset.
    throw new Error(
      "layer2 prompt is missing the {{compliance_ruleset}} slot — refusing to run the AI pass without the rulebook",
    );
  }
  return promptText.replace(/\{\{\s*compliance_ruleset\s*\}\}/g, ruleset.promptText);
}

async function runAiPass(
  gemini: Layer2Gemini,
  subject: ValidationSubject,
  ruleset: ResolvedRuleset,
  promptText: string,
): Promise<Violation[]> {
  const systemInstruction = buildSystemInstruction(promptText, ruleset);
  const res = await gemini.generateJSON({
    useCase: "validation",
    operation: "compliance_layer2",
    schema: LAYER2_VERDICT_SCHEMA,
    systemInstruction,
    prompt: buildSubjectPrompt(subject),
  });
  return res.data.violations.map((v) => ({
    ruleId: v.rule_id,
    severity: coerceSeverity(v.severity),
    fieldPath: v.excerpt ? `excerpt: "${truncate(v.excerpt)}"` : null,
    description: v.explanation || v.excerpt || v.rule_id,
    source: "ai" as const,
  }));
}

/**
 * Merge AI violations into the (authoritative) deterministic set. An AI flag for
 * a rule the deterministic pass already caught is dropped — the deterministic
 * one has the precise field path. Duplicate AI flags (same rule + excerpt) are
 * collapsed.
 */
function mergeViolations(deterministic: Violation[], ai: Violation[]): Violation[] {
  const detRuleIds = new Set(deterministic.map((v) => v.ruleId));
  const seen = new Set<string>();
  const merged = [...deterministic];
  for (const v of ai) {
    if (detRuleIds.has(v.ruleId)) continue;
    const key = `${v.ruleId}|${v.fieldPath ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(v);
  }
  return merged;
}

export interface ValidateContentOptions {
  subject: ValidationSubject;
  ruleset: ResolvedRuleset;
  /** When supplied, the AI semantic pass runs through this client. */
  gemini?: Layer2Gemini;
  /** The layer2-validate prompt text (with the {{compliance_ruleset}} slot). The
   *  wired entry point loads it from disk; tests inject it. Required to run the AI pass. */
  layer2PromptText?: string;
}

/**
 * Run Layer 2. Deterministic checks always run; the AI pass runs only when a
 * gemini client (and prompt text) are supplied. Verdict is `fail` if there is
 * any violation. The result records the ruleset version (recorded on consumers)
 * and whether the AI pass ran.
 */
export async function validateContent(opts: ValidateContentOptions): Promise<Layer2Result> {
  const deterministic = validateDeterministic(opts.subject, opts.ruleset);

  let aiViolations: Violation[] = [];
  let aiPassRan = false;
  if (opts.gemini && opts.layer2PromptText) {
    aiViolations = await runAiPass(opts.gemini, opts.subject, opts.ruleset, opts.layer2PromptText);
    aiPassRan = true;
  }

  const violations = mergeViolations(deterministic, aiViolations);
  return {
    verdict: violations.length > 0 ? "fail" : "pass",
    violations,
    rulesetVersion: opts.ruleset.versionString,
    aiPassRan,
  };
}
