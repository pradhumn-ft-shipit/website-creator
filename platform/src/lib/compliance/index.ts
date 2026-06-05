/**
 * Public surface of the compliance engine (PRD §5) — the Layer-2 validator +
 * ruleset loader. Callers (020 generation, 029 edit chat, 031 blog, 034 admin
 * review) import from here; the internal module split stays hidden.
 *
 * The headline entry is `runLayer2`: it loads + resolves the active ruleset,
 * loads the Layer-2 prompt (only when an AI pass will run), and validates a
 * subject — one call from "I have copy" to "here is the pass/fail verdict".
 */

import { loadPrompt } from "@/lib/prompts/loader";

import { loadAndResolveRuleset } from "./loader";
import {
  validateContent,
  type Layer2Gemini,
  type Layer2Result,
  type ValidationSubject,
} from "./validator";
import type { Registration } from "./ruleset";

export interface RunLayer2Options {
  subject: ValidationSubject;
  /** SEC vs. state registration (drives the disclosure line + overlay). Default "sec". */
  registration?: Registration;
  /** Adviser's primary state (applies the matching state overlay for state-registered). */
  primaryState?: string | null;
  /** Supply a Gemini client to run the AI semantic pass; omit for deterministic-only. */
  gemini?: Layer2Gemini;
  /** Ruleset location overrides (default: active RIA ruleset under <repo>/compliance). */
  industry?: string;
  version?: string;
  dir?: string;
}

/**
 * Run Layer 2 end-to-end: resolve the active ruleset for the adviser, then
 * validate the subject (deterministic checks always; AI semantic pass when a
 * gemini client is supplied). Returns the verdict + violations + ruleset version.
 */
export async function runLayer2(opts: RunLayer2Options): Promise<Layer2Result> {
  const ruleset = loadAndResolveRuleset({
    registration: opts.registration ?? "sec",
    primaryState: opts.primaryState,
    industry: opts.industry,
    version: opts.version,
    dir: opts.dir,
  });

  // Only read the prompt off disk when the AI pass will actually run.
  const layer2PromptText = opts.gemini ? loadPrompt("layer2-validate").text : undefined;

  return validateContent({
    subject: opts.subject,
    ruleset,
    gemini: opts.gemini,
    layer2PromptText,
  });
}

// ---- re-exports ----

export {
  loadRuleset,
  loadAndResolveRuleset,
  ACTIVE_RIA_INDUSTRY,
  ACTIVE_RIA_VERSION,
  type LoadRulesetOptions,
  type ResolveRulesetOptions,
} from "./loader";

export {
  parseRulesJson,
  resolveRuleset,
  rulesetVersionString,
  buildRulesetPrompt,
  type Ruleset,
  type ResolvedRuleset,
  type LoadedRuleset,
  type Registration,
  type Severity,
  type ProhibitedTermGroup,
  type ProhibitedContentRule,
  type RequiredElement,
  type RequiredDisclosure,
  type ConditionalRule,
} from "./ruleset";

export {
  validateContent,
  validateDeterministic,
  LAYER2_VERDICT_SCHEMA,
  type Violation,
  type ViolationSource,
  type Layer2Result,
  type Layer2Verdict,
  type ValidationSubject,
  type ValidateContentOptions,
  type Layer2Gemini,
} from "./validator";

export {
  mirrorRuleset,
  recordViolations,
  mirrorRulesetWithClient,
  recordViolationsWithClient,
  type MirrorResult,
  type RecordViolationsInput,
  type RecordViolationsResult,
} from "./persistence";
