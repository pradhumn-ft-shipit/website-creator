/**
 * Compliance ruleset domain — pure core (PRD §5.2, §5.3, §5.5, §5.6).
 *
 * Two things live here and nowhere else:
 *   1. The typed shape of a parsed `rules.json` (`parseRulesJson` validates the
 *      on-disk snake_case artifact and maps it to a camelCase `Ruleset`,
 *      path-qualifying any malformation so a bad ruleset fails loud).
 *   2. Resolution — applying the SEC-vs-state conditional rule + the matching
 *      state overlay (`resolveRuleset`) and rendering the authoritative
 *      `{{compliance_ruleset}}` text the Layer-2 Flash pass reads
 *      (`buildRulesetPrompt`).
 *
 * No IO: the loader (`loader.ts`) reads the artifacts off disk and hands them
 * here. That keeps every rule of business logic unit-testable without a file
 * system, mirroring the pure/IO split used across the repo (auth, orders).
 */

export type Severity = "low" | "medium" | "high";
export type Registration = "sec" | "state";

/** A prohibited-term group from rules.json. `requiresSubstantiation` decides the
 *  layer split: false → deterministic scan (always wrong); true → AI pass judges
 *  context (e.g. "best" is fine when substantiated). */
export interface ProhibitedTermGroup {
  id: string;
  terms: string[];
  severity: Severity;
  match: "word" | "substring";
  requiresSubstantiation: boolean;
  citation: string;
  description: string;
}

/** A semantic prohibited-content category — judged by the AI pass, not regex. */
export interface ProhibitedContentRule {
  id: string;
  description: string;
  severity: Severity;
  citation: string;
}

/** A required link element (footer/page), checked deterministically by link kind. */
export interface RequiredElement {
  id: string;
  label: string;
  linkKind: string;
  placement: string[];
  citation: string;
}

/** A required disclosure with a `textPattern` checked deterministically in copy. */
export interface RequiredDisclosure {
  id: string;
  label: string;
  template: string;
  textPattern: string;
  placement: string[];
  citation: string;
}

/** SEC-vs-state conditional rule (which registration line + whether overlay applies). */
export interface ConditionalRule {
  id: string;
  when: { registration: Registration };
  requires: string[];
  template: string;
  appliesOverlay: boolean;
  description: string;
  citation: string;
}

export interface Citation {
  title: string;
  url: string;
}

export interface Ruleset {
  industry: string;
  version: string;
  status: string;
  prohibitedTerms: ProhibitedTermGroup[];
  prohibitedContent: ProhibitedContentRule[];
  requiredElements: RequiredElement[];
  requiredDisclosures: RequiredDisclosure[];
  conditionalRules: ConditionalRule[];
  citations: Record<string, Citation>;
}

/** Artifacts the loader gathers off disk and hands to `resolveRuleset` (pure). */
export interface LoadedRuleset {
  industry: string;
  version: string;
  rules: Ruleset;
  rulesMarkdown: string;
  footerTemplate: string;
  /** Uppercase state code → overlay markdown. */
  overlays: Record<string, string>;
}

/** A fully resolved ruleset for one adviser: rules + applied overlay + prompt text. */
export interface ResolvedRuleset {
  industry: string;
  version: string;
  /** Path-style version recorded on every consumer artifact, e.g. "ria/v1.0". */
  versionString: string;
  rules: Ruleset;
  registration: Registration;
  primaryState: string | null;
  /** The applied state overlay (state-registered advisers only), else null. */
  overlay: { state: string; text: string } | null;
  footerTemplate: string;
  rulesMarkdown: string;
  /** The authoritative block injected into the Layer-2 system prompt. */
  promptText: string;
}

// ---- parsing (pure, path-qualified like prompts/schema.ts) ----

function fail(path: string, msg: string): never {
  throw new Error(`${path}: ${msg}`);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown, path: string): string {
  if (typeof v !== "string" || v === "") fail(path, "must be a non-empty string");
  return v;
}

function strArray(v: unknown, path: string): string[] {
  if (!Array.isArray(v) || v.some((s) => typeof s !== "string")) {
    fail(path, "must be an array of strings");
  }
  return v as string[];
}

const SEVERITIES: ReadonlySet<string> = new Set(["low", "medium", "high"]);
function severity(v: unknown, path: string): Severity {
  if (typeof v !== "string" || !SEVERITIES.has(v)) fail(path, "must be low|medium|high");
  return v as Severity;
}

function registration(v: unknown, path: string): Registration {
  if (v !== "sec" && v !== "state") fail(path, "must be 'sec' or 'state'");
  return v;
}

/** Validate + map an on-disk `rules.json` object to the typed `Ruleset`. */
export function parseRulesJson(raw: unknown): Ruleset {
  if (!isObject(raw)) fail("rules", "must be an object");

  const prohibitedTermsRaw = raw.prohibited_terms;
  if (!Array.isArray(prohibitedTermsRaw)) fail("prohibited_terms", "must be an array");
  const prohibitedTerms: ProhibitedTermGroup[] = prohibitedTermsRaw.map((g, i) => {
    const p = `prohibited_terms[${i}]`;
    if (!isObject(g)) fail(p, "must be an object");
    return {
      id: str(g.id, `${p}.id`),
      terms: strArray(g.terms, `${p}.terms`),
      severity: severity(g.severity, `${p}.severity`),
      match: g.match === "substring" ? "substring" : "word",
      requiresSubstantiation: g.requires_substantiation === true,
      citation: str(g.citation, `${p}.citation`),
      description: typeof g.description === "string" ? g.description : "",
    };
  });

  const prohibitedContentRaw = raw.prohibited_content;
  if (!Array.isArray(prohibitedContentRaw)) fail("prohibited_content", "must be an array");
  const prohibitedContent: ProhibitedContentRule[] = prohibitedContentRaw.map((c, i) => {
    const p = `prohibited_content[${i}]`;
    if (!isObject(c)) fail(p, "must be an object");
    return {
      id: str(c.id, `${p}.id`),
      description: str(c.description, `${p}.description`),
      severity: severity(c.severity, `${p}.severity`),
      citation: str(c.citation, `${p}.citation`),
    };
  });

  const requiredElementsRaw = raw.required_elements;
  if (!Array.isArray(requiredElementsRaw)) fail("required_elements", "must be an array");
  const requiredElements: RequiredElement[] = requiredElementsRaw.map((e, i) => {
    const p = `required_elements[${i}]`;
    if (!isObject(e)) fail(p, "must be an object");
    return {
      id: str(e.id, `${p}.id`),
      label: str(e.label, `${p}.label`),
      linkKind: str(e.link_kind, `${p}.link_kind`),
      placement: strArray(e.placement, `${p}.placement`),
      citation: str(e.citation, `${p}.citation`),
    };
  });

  const requiredDisclosuresRaw = raw.required_disclosures;
  if (!Array.isArray(requiredDisclosuresRaw)) fail("required_disclosures", "must be an array");
  const requiredDisclosures: RequiredDisclosure[] = requiredDisclosuresRaw.map((d, i) => {
    const p = `required_disclosures[${i}]`;
    if (!isObject(d)) fail(p, "must be an object");
    return {
      id: str(d.id, `${p}.id`),
      label: str(d.label, `${p}.label`),
      template: str(d.template, `${p}.template`),
      textPattern: str(d.text_pattern, `${p}.text_pattern`),
      placement: strArray(d.placement, `${p}.placement`),
      citation: str(d.citation, `${p}.citation`),
    };
  });

  const conditionalRaw = raw.conditional_rules;
  if (!Array.isArray(conditionalRaw)) fail("conditional_rules", "must be an array");
  const conditionalRules: ConditionalRule[] = conditionalRaw.map((c, i) => {
    const p = `conditional_rules[${i}]`;
    if (!isObject(c)) fail(p, "must be an object");
    if (!isObject(c.when)) fail(`${p}.when`, "must be an object");
    return {
      id: str(c.id, `${p}.id`),
      when: { registration: registration(c.when.registration, `${p}.when.registration`) },
      requires: strArray(c.requires, `${p}.requires`),
      template: str(c.template, `${p}.template`),
      appliesOverlay: c.applies_overlay === true,
      description: typeof c.description === "string" ? c.description : "",
      citation: str(c.citation, `${p}.citation`),
    };
  });

  const citations: Record<string, Citation> = {};
  if (isObject(raw.citations)) {
    for (const [key, value] of Object.entries(raw.citations)) {
      if (isObject(value) && typeof value.title === "string" && typeof value.url === "string") {
        citations[key] = { title: value.title, url: value.url };
      }
    }
  }

  return {
    industry: str(raw.industry, "industry"),
    version: str(raw.version, "version"),
    status: typeof raw.status === "string" ? raw.status : "draft",
    prohibitedTerms,
    prohibitedContent,
    requiredElements,
    requiredDisclosures,
    conditionalRules,
    citations,
  };
}

// ---- resolution (pure) ----

/** Path-style version string recorded on every consumer artifact ("ria/v1.0"). */
export function rulesetVersionString(industry: string, version: string): string {
  return `${industry}/v${version}`;
}

/** The conditional rule whose `when.registration` matches, if any. */
function registrationRule(rules: Ruleset, reg: Registration): ConditionalRule | null {
  return rules.conditionalRules.find((r) => r.when.registration === reg) ?? null;
}

/**
 * Render the authoritative `{{compliance_ruleset}}` text injected into the
 * Layer-2 system prompt. Derived from the structured rules (not the long
 * rules.md) so it stays in lockstep and within the §8.4 input budget. Splits
 * prohibited terms into "never allowed" vs "only without substantiation" so the
 * Flash pass knows which need context judgement.
 */
export function buildRulesetPrompt(
  rules: Ruleset,
  opts: { registration: Registration; overlayText: string | null },
): string {
  const hard: string[] = [];
  const conditional: string[] = [];
  for (const g of rules.prohibitedTerms) {
    (g.requiresSubstantiation ? conditional : hard).push(...g.terms);
  }

  const lines: string[] = [];
  lines.push(`RIA compliance ruleset — ${opts.registration}-registered adviser.`);
  lines.push("");
  lines.push("PROHIBITED TERMS (never allowed in any copy):");
  lines.push(`  ${hard.join(", ")}`);
  if (conditional.length) {
    lines.push("PROHIBITED UNLESS SUBSTANTIATED (flag when used as a marketing claim without the required disclosures):");
    lines.push(`  ${conditional.join(", ")}`);
  }
  lines.push("");
  lines.push("PROHIBITED CONTENT (flag any of these, judged semantically):");
  for (const c of rules.prohibitedContent) {
    lines.push(`  - [${c.id}, ${c.severity}] ${c.description}`);
  }
  lines.push("");
  lines.push("REQUIRED ELEMENTS (must be present, typically in the footer):");
  for (const e of rules.requiredElements) {
    lines.push(`  - ${e.label} (${e.placement.join(", ")})`);
  }
  lines.push("");
  lines.push("REQUIRED DISCLOSURES (the copy must contain this language):");
  for (const d of rules.requiredDisclosures) {
    lines.push(`  - ${d.label}: "${d.template}"`);
  }

  const regRule = registrationRule(rules, opts.registration);
  if (regRule) {
    lines.push("");
    lines.push(`REGISTRATION LINE (${opts.registration}): ${regRule.template}`);
  }

  if (opts.overlayText) {
    lines.push("");
    lines.push("STATE OVERLAY (additional state-specific requirements):");
    lines.push(opts.overlayText.trim());
  }

  return lines.join("\n");
}

/**
 * Resolve a loaded ruleset for one adviser: pick the SEC/state registration
 * line, apply the matching state overlay for state-registered advisers, and
 * render the prompt text. Overlay lookup is case-insensitive on the state code.
 */
export function resolveRuleset(
  loaded: LoadedRuleset,
  opts: { registration: Registration; primaryState?: string | null },
): ResolvedRuleset {
  const primaryState = opts.primaryState?.trim().toUpperCase() || null;
  const regRule = registrationRule(loaded.rules, opts.registration);
  const wantsOverlay = opts.registration === "state" && (regRule?.appliesOverlay ?? true);

  let overlay: { state: string; text: string } | null = null;
  if (wantsOverlay && primaryState && loaded.overlays[primaryState]) {
    overlay = { state: primaryState, text: loaded.overlays[primaryState] };
  }

  const promptText = buildRulesetPrompt(loaded.rules, {
    registration: opts.registration,
    overlayText: overlay?.text ?? null,
  });

  return {
    industry: loaded.industry,
    version: loaded.version,
    versionString: rulesetVersionString(loaded.industry, loaded.version),
    rules: loaded.rules,
    registration: opts.registration,
    primaryState,
    overlay,
    footerTemplate: loaded.footerTemplate,
    rulesMarkdown: loaded.rulesMarkdown,
    promptText,
  };
}
