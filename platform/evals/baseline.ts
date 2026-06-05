/**
 * Eval baseline — the fixed expectations the golden cases assert against,
 * derived from PRD §18.2 (RIA compliance quick-reference) and §8.2 (prompt
 * principles). This is deliberately a *self-contained* baseline, NOT the live
 * compliance ruleset: 005's ruleset is still a placeholder and will be edited
 * over time, but the eval gate must stay deterministic so a prompt regression
 * is the only thing that can turn it red. When 006's ruleset loader lands, live
 * Layer-2 validation uses the ruleset; these evals keep their own frozen list.
 */

import { GENERATED_SITE_SCHEMA } from "@/lib/prompts/schema";
import type {
  DisclosureRule,
  EvalContext,
  PromptContractRule,
} from "@/lib/evals/runner";

/**
 * Hard-prohibited, context-free terms (§18.2). The context-dependent ones
 * ("best" / "top-ranked" / "outperform" *without substantiation*) are Layer-2's
 * nuanced job — a deterministic substring gate would false-positive on them, so
 * the eval baseline scans only the unambiguous terms.
 */
export const PROHIBITED_TERMS = [
  "guarantee",
  "guaranteed",
  "guarantees",
  "promise",
  "promised",
  "promises",
  "no risk",
  "risk-free",
  "risk free",
];

/** Mandatory on every RIA site (§18.2). */
export const REQUIRED_DISCLOSURES: DisclosureRule[] = [
  { id: "adv_2a", label: "Form ADV Part 2A link", kind: "footer_link", linkKind: "adv_2a" },
  { id: "adv_2b", label: "Form ADV Part 2B link", kind: "footer_link", linkKind: "adv_2b" },
  { id: "crs", label: "Form CRS link", kind: "footer_link", linkKind: "crs" },
  { id: "privacy", label: "Privacy policy link", kind: "footer_link", linkKind: "privacy" },
  {
    id: "registration_disclaimer",
    label: "registration-does-not-imply disclaimer",
    kind: "text",
    pattern: "registration does not imply",
  },
];

/** §8.2 markers a *generation* prompt (generate-site, edit-chat) must carry. */
export const GENERATION_CONTRACT: PromptContractRule[] = [
  { id: "ruleset_in_system", label: "compliance ruleset in system prompt (§8.2.2)", pattern: "\\{\\{\\s*compliance_ruleset\\s*\\}\\}" },
  { id: "json_output", label: "JSON-only output (§8.2.3)", pattern: "json" },
  { id: "confidence", label: "per-field confidence (§8.2.4)", pattern: "confidence" },
  { id: "sources", label: "per-field sources (§8.2.4)", pattern: "sources" },
  { id: "brand_voice", label: "brand-voice slot (§8.2.5)", pattern: "\\{\\{\\s*brand_voice\\s*\\}\\}" },
  { id: "token_budget", label: "token budget note (§8.2.7)", pattern: "token budget|hard cap" },
];

/** Lighter contract for *validator* prompts (layer2-validate, blog-check). */
export const VALIDATOR_CONTRACT: PromptContractRule[] = [
  { id: "ruleset_in_system", label: "compliance ruleset in system prompt (§8.2.2)", pattern: "\\{\\{\\s*compliance_ruleset\\s*\\}\\}" },
  { id: "json_output", label: "JSON-only verdict (§8.2.3)", pattern: "json" },
  { id: "verdict", label: "structured verdict", pattern: "verdict" },
];

export const EVAL_CONTEXT: EvalContext = {
  schema: GENERATED_SITE_SCHEMA,
  prohibitedTerms: PROHIBITED_TERMS,
  requiredDisclosures: REQUIRED_DISCLOSURES,
  promptContract: GENERATION_CONTRACT,
};
