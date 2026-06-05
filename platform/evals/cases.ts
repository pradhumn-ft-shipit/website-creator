/**
 * Golden eval cases (PRD §8.6) — input fixtures + the *properties* each must
 * satisfy (never exact text). Two kinds:
 *   - output-property: a candidate generated output checked for compliance
 *     properties (schema, prohibited terms, disclosures, confidence/sources).
 *   - prompt-contract: a real prompt checked for the §8.2 markers.
 *
 * Negative cases (`expect: "fail"`) are how we prove the gate has teeth: the
 * case is `ok` only when the bad input is actually caught. To add a case when a
 * real customer hits an edge worth preventing (§8.6), append here.
 */

import { join } from "node:path";

import { loadPrompt } from "@/lib/prompts/loader";
import type { EvalCase } from "@/lib/evals/runner";

import { GENERATION_CONTRACT, VALIDATOR_CONTRACT } from "./baseline";
import goodSite from "./fixtures/good-site.json";

const FIXTURES_DIR = join(process.cwd(), "evals/fixtures");

type Site = typeof goodSite;

/** Deep-clone the reference good site and mutate one thing away from valid. */
function variant(mutate: (s: Site) => void): Site {
  const clone = structuredClone(goodSite) as Site;
  mutate(clone);
  return clone;
}

const ALL_OUTPUT_CHECKS = [
  "schema_valid",
  "no_prohibited_terms",
  "required_disclosures_present",
  "footer_contains_crs_link",
  "field_confidence_sources",
] as const;

export function buildCases(): EvalCase[] {
  return [
    // ---- output-property: the happy path ----
    {
      name: "good-site",
      kind: "output-property",
      expect: "pass",
      asserts: [...ALL_OUTPUT_CHECKS],
      output: goodSite,
      note: "A fully-compliant generated site passes every property.",
    },
    {
      name: "clean-copy-no-false-positive",
      kind: "output-property",
      expect: "pass",
      asserts: [...ALL_OUTPUT_CHECKS],
      output: variant((s) => {
        s.pages[0].sections[1].body.value = "We never compromise on our fiduciary duty.";
      }),
      note: "'compromise' must NOT trip the 'promise' prohibited-term scan (word boundaries).",
    },

    // ---- output-property: negative (must be caught) ----
    {
      name: "prohibited-guaranteed",
      kind: "output-property",
      expect: "fail",
      asserts: ["no_prohibited_terms"],
      output: variant((s) => {
        s.pages[0].sections[0].body.value = "Our plan is guaranteed to beat the market.";
      }),
    },
    {
      name: "prohibited-no-risk",
      kind: "output-property",
      expect: "fail",
      asserts: ["no_prohibited_terms"],
      output: variant((s) => {
        s.firm.tagline.value = "A no risk path to retirement.";
      }),
    },
    {
      name: "missing-crs-link",
      kind: "output-property",
      expect: "fail",
      asserts: ["footer_contains_crs_link"],
      output: variant((s) => {
        s.footer.links = s.footer.links.filter((l) => l.kind !== "crs");
      }),
    },
    {
      name: "missing-adv-2b-disclosure",
      kind: "output-property",
      expect: "fail",
      asserts: ["required_disclosures_present"],
      output: variant((s) => {
        s.footer.links = s.footer.links.filter((l) => l.kind !== "adv_2b");
      }),
    },
    {
      name: "missing-registration-disclaimer",
      kind: "output-property",
      expect: "fail",
      asserts: ["required_disclosures_present"],
      output: variant((s) => {
        s.footer.disclaimer.value = "This website is for informational purposes only.";
      }),
    },
    {
      name: "field-missing-confidence",
      kind: "output-property",
      expect: "fail",
      asserts: ["field_confidence_sources"],
      output: variant((s) => {
        delete (s.firm.name as { confidence?: number }).confidence;
      }),
    },
    {
      name: "field-confidence-out-of-range",
      kind: "output-property",
      expect: "fail",
      asserts: ["field_confidence_sources"],
      output: variant((s) => {
        s.firm.tagline.confidence = 1.5;
      }),
    },
    {
      name: "schema-wrong-version",
      kind: "output-property",
      expect: "fail",
      asserts: ["schema_valid"],
      output: variant((s) => {
        (s as { schemaVersion: string }).schemaVersion = "site.v0";
      }),
    },

    // ---- prompt-contract: the real prompts must carry the §8.2 markers ----
    {
      name: "prompt-generate-site-contract",
      kind: "prompt-contract",
      expect: "pass",
      asserts: ["prompt_contract"],
      contractRules: GENERATION_CONTRACT,
      promptText: loadPrompt("generate-site").text,
    },
    {
      name: "prompt-edit-chat-contract",
      kind: "prompt-contract",
      expect: "pass",
      asserts: ["prompt_contract"],
      contractRules: GENERATION_CONTRACT,
      promptText: loadPrompt("edit-chat").text,
    },
    {
      name: "prompt-layer2-validate-contract",
      kind: "prompt-contract",
      expect: "pass",
      asserts: ["prompt_contract"],
      contractRules: VALIDATOR_CONTRACT,
      promptText: loadPrompt("layer2-validate").text,
    },
    {
      name: "prompt-blog-check-contract",
      kind: "prompt-contract",
      expect: "pass",
      asserts: ["prompt_contract"],
      contractRules: VALIDATOR_CONTRACT,
      promptText: loadPrompt("blog-check").text,
    },
    {
      name: "broken-prompt-is-rejected",
      kind: "prompt-contract",
      expect: "fail",
      asserts: ["prompt_contract"],
      contractRules: GENERATION_CONTRACT,
      promptText: loadPrompt("broken-prompt", { dir: FIXTURES_DIR }).text,
      note: "Negative: a prompt dropping the §8.2 markers MUST be caught (gate has teeth).",
    },
  ];
}
