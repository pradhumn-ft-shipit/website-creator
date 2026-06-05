import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, existsSync } from "node:fs";

import {
  checkRulesJson,
  checkCitations,
  checkManifest,
  checkReviewGate,
  checkFooter,
  lintRuleset,
  lintAll,
} from "./lint.mjs";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "__fixtures__");

// A minimal well-formed rules.json object that individual tests mutate to
// introduce exactly one defect.
function validRules() {
  return {
    industry: "ria",
    version: "1.0",
    status: "draft",
    prohibited_terms: [
      {
        id: "guarantee",
        terms: ["guarantee", "guaranteed"],
        severity: "high",
        match: "word",
        requires_substantiation: false,
        citation: "sec_marketing_rule",
      },
    ],
    required_elements: [
      { id: "crs", label: "Form CRS", placement: ["footer", "page"], link_kind: "crs", citation: "sec_form_crs" },
    ],
    required_disclosures: [
      {
        id: "registration_disclaimer",
        template: "Registration does not imply a certain level of skill or training.",
        placement: ["footer"],
        citation: "sec_adv",
      },
    ],
    conditional_rules: [],
    citations: {
      sec_marketing_rule: { title: "SEC Marketing Rule 206(4)-1", url: "https://www.sec.gov/" },
      sec_form_crs: { title: "Form CRS", url: "https://www.sec.gov/" },
      sec_adv: { title: "Form ADV", url: "https://www.sec.gov/" },
    },
  };
}

// --- checkRulesJson -------------------------------------------------------

test("checkRulesJson: well-formed rules produce no errors", () => {
  assert.deepEqual(checkRulesJson(validRules()), []);
});

test("checkRulesJson: a prohibited term missing severity is flagged", () => {
  const rules = validRules();
  delete rules.prohibited_terms[0].severity;
  const errors = checkRulesJson(rules);
  assert.ok(errors.some((e) => /severity/.test(e) && /prohibited_terms\[0\]/.test(e)), errors.join("\n"));
});

test("checkRulesJson: an invalid severity value is flagged", () => {
  const rules = validRules();
  rules.prohibited_terms[0].severity = "critical";
  assert.ok(checkRulesJson(rules).some((e) => /severity/.test(e)));
});

test("checkRulesJson: empty terms list is flagged", () => {
  const rules = validRules();
  rules.prohibited_terms[0].terms = [];
  assert.ok(checkRulesJson(rules).some((e) => /terms/.test(e)));
});

test("checkRulesJson: an invalid match mode is flagged", () => {
  const rules = validRules();
  rules.prohibited_terms[0].match = "fuzzy";
  assert.ok(checkRulesJson(rules).some((e) => /match/.test(e)));
});

test("checkRulesJson: non-boolean requires_substantiation is flagged", () => {
  const rules = validRules();
  rules.prohibited_terms[0].requires_substantiation = "no";
  assert.ok(checkRulesJson(rules).some((e) => /requires_substantiation/.test(e)));
});

test("checkRulesJson: a required element missing placement is flagged", () => {
  const rules = validRules();
  delete rules.required_elements[0].placement;
  assert.ok(checkRulesJson(rules).some((e) => /placement/.test(e) && /required_elements\[0\]/.test(e)));
});

test("checkRulesJson: an invalid placement value is flagged", () => {
  const rules = validRules();
  rules.required_elements[0].placement = ["sidebar"];
  assert.ok(checkRulesJson(rules).some((e) => /placement/.test(e)));
});

test("checkRulesJson: a disclosure without template or text_pattern is flagged", () => {
  const rules = validRules();
  delete rules.required_disclosures[0].template;
  assert.ok(checkRulesJson(rules).some((e) => /template.*text_pattern|text_pattern/.test(e)));
});

test("checkRulesJson: a missing top-level array is flagged", () => {
  const rules = validRules();
  delete rules.prohibited_terms;
  assert.ok(checkRulesJson(rules).some((e) => /prohibited_terms.*array/.test(e)));
});

test("checkRulesJson: a prohibited_content entry missing description is flagged", () => {
  const rules = validRules();
  rules.prohibited_content = [{ id: "testimonials", severity: "high", citation: "sec_marketing_rule" }];
  assert.ok(
    checkRulesJson(rules).some((e) => /prohibited_content\[0\]\.description/.test(e)),
    "expected a description error",
  );
});

test("checkRulesJson: a well-formed prohibited_content entry passes", () => {
  const rules = validRules();
  rules.prohibited_content = [
    { id: "testimonials", description: "Testimonials disallowed in v1.", severity: "high", citation: "sec_marketing_rule" },
  ];
  assert.deepEqual(checkRulesJson(rules), []);
});

// --- checkCitations -------------------------------------------------------

test("checkCitations: a rule citing an unknown id is flagged", () => {
  const rules = validRules();
  rules.prohibited_terms[0].citation = "nope";
  assert.ok(checkCitations(rules).some((e) => /unknown citation "nope"/.test(e)));
});

test("checkCitations: fully resolved citations produce no errors", () => {
  assert.deepEqual(checkCitations(validRules()), []);
});

test("checkCitations: a citation entry without a title is flagged", () => {
  const rules = validRules();
  rules.citations.sec_adv = { url: "https://www.sec.gov/" };
  assert.ok(checkCitations(rules).some((e) => /citations\.sec_adv.*title/.test(e)));
});

// --- checkManifest --------------------------------------------------------

function validManifest() {
  return {
    industry: "ria",
    version: "1.0",
    artifacts: { rules_machine: "rules.json", rules_human: "rules.md", disclosures_dir: "disclosures/" },
    state_overlays: [{ state: "CA", file: "disclosures/state-overlays/ca.md" }],
    review: { two_person_required: true, reviewers: [], approved: false },
  };
}

test("checkManifest: all references resolving produces no errors", () => {
  assert.deepEqual(checkManifest(validManifest(), () => true), []);
});

test("checkManifest: an unresolved artifact path is flagged", () => {
  const errors = checkManifest(validManifest(), (p) => p !== "rules.json");
  assert.ok(errors.some((e) => /rules_machine.*does not exist/.test(e)));
});

test("checkManifest: an unresolved state overlay file is flagged", () => {
  const errors = checkManifest(validManifest(), (p) => !p.includes("ca.md"));
  assert.ok(errors.some((e) => /state_overlays\[0\]\.file.*does not exist/.test(e)));
});

// --- checkReviewGate (§5.7 publish guard) ---------------------------------

test("checkReviewGate: an unapproved ruleset is unconstrained", () => {
  assert.deepEqual(checkReviewGate(validManifest()), []);
});

test("checkReviewGate: approved with <2 reviewers is flagged", () => {
  const m = validManifest();
  m.review = { ...m.review, reviewers: ["a@wri.com"], approved: true };
  m.published_at = "2026-06-01";
  m.published_by = "a@wri.com";
  assert.ok(checkReviewGate(m).some((e) => /≥2 reviewers/.test(e)));
});

test("checkReviewGate: approved without published_at/by is flagged", () => {
  const m = validManifest();
  m.review = { two_person_required: true, reviewers: ["a@wri.com", "b@wri.com"], approved: true };
  const errors = checkReviewGate(m);
  assert.ok(errors.some((e) => /published_at/.test(e)));
  assert.ok(errors.some((e) => /published_by/.test(e)));
});

test("checkReviewGate: properly approved ruleset passes", () => {
  const m = validManifest();
  m.review = { two_person_required: true, reviewers: ["a@wri.com", "b@wri.com"], approved: true };
  m.published_at = "2026-06-01";
  m.published_by = "a@wri.com";
  assert.deepEqual(checkReviewGate(m), []);
});

// --- checkFooter (§18.2) --------------------------------------------------

const GOOD_FOOTER = `{{firm_name}} is a {{registration_status}} investment adviser.
Registration does not imply a certain level of skill or training.
Information on this website is for informational purposes only.
[Form ADV Part 2A] [Form ADV Part 2B] [Form CRS] [Privacy Policy]`;

test("checkFooter: the §18.2 template passes", () => {
  assert.deepEqual(checkFooter(GOOD_FOOTER), []);
});

test("checkFooter: a missing Form CRS link is flagged", () => {
  const footer = GOOD_FOOTER.replace("[Form CRS] ", "");
  assert.ok(checkFooter(footer).some((e) => /Form CRS/.test(e)));
});

test("checkFooter: a missing firm_name placeholder is flagged", () => {
  const footer = GOOD_FOOTER.replace("{{firm_name}}", "Acme");
  assert.ok(checkFooter(footer).some((e) => /firm_name/.test(e)));
});

// --- lintRuleset / lintAll (integration against fixtures) -----------------

test("lintRuleset: the valid fixture passes", () => {
  const { ok, errors } = lintRuleset(join(FIXTURES, "valid", "v1.0"));
  assert.equal(ok, true, errors.join("\n"));
});

test("lintRuleset: the malformed fixture fails with multiple errors", () => {
  const { ok, errors } = lintRuleset(join(FIXTURES, "malformed", "v1.0"));
  assert.equal(ok, false);
  // Spot-check that each seeded defect is reported.
  assert.ok(errors.some((e) => /severity/.test(e)), "severity defect");
  assert.ok(errors.some((e) => /unknown citation/.test(e)), "citation defect");
  assert.ok(errors.some((e) => /placement/.test(e)), "placement defect");
  assert.ok(errors.some((e) => /does not exist/.test(e)), "overlay defect");
  assert.ok(errors.some((e) => /≥2 reviewers/.test(e)), "review gate defect");
  assert.ok(errors.some((e) => /Form CRS/.test(e)), "footer defect");
});

test("lintAll: discovers fixtures and reports the valid one ok, malformed not", () => {
  const { results } = lintAll(FIXTURES);
  const valid = results.find((r) => r.dir === "valid/v1.0");
  const malformed = results.find((r) => r.dir === "malformed/v1.0");
  assert.equal(valid?.ok, true);
  assert.equal(malformed?.ok, false);
});

// --- the real authored ruleset (durable regression guard) -----------------

const COMPLIANCE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("the authored ria/v1.0 ruleset passes lint", () => {
  const { ok, errors } = lintRuleset(join(COMPLIANCE_ROOT, "ria", "v1.0"));
  assert.equal(ok, true, errors.join("\n"));
});

test("ria/v1.0 declares all top-10 state overlays and each file resolves", () => {
  const manifest = JSON.parse(
    readFileSync(join(COMPLIANCE_ROOT, "ria", "v1.0", "manifest.json"), "utf8"),
  );
  const states = manifest.state_overlays.map((o) => o.state).sort();
  assert.deepEqual(states, ["CA", "FL", "GA", "IL", "MA", "NJ", "NY", "OH", "PA", "TX"]);
  for (const o of manifest.state_overlays) {
    assert.ok(existsSync(join(COMPLIANCE_ROOT, "ria", "v1.0", o.file)), `${o.file} missing`);
  }
});

test("ria/v1.0 is not yet approved (publish gate — §5.7)", () => {
  const manifest = JSON.parse(
    readFileSync(join(COMPLIANCE_ROOT, "ria", "v1.0", "manifest.json"), "utf8"),
  );
  assert.equal(manifest.review.approved, false);
});
