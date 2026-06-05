import { describe, it, expect } from "vitest";

import { GENERATED_SITE_SCHEMA, SCHEMA_VERSION, type GeneratedField } from "@/lib/prompts/schema";
import {
  runEval,
  runEvals,
  formatReport,
  type EvalCase,
  type EvalContext,
} from "./runner";

function field(value: string, confidence = 0.9): GeneratedField {
  return { value, confidence, sources: ["intake"] };
}

function goodOutput() {
  return {
    schemaVersion: SCHEMA_VERSION,
    firm: {
      name: field("Acme Wealth Partners"),
      tagline: field("Fee-only planning for families"),
      registration: field("SEC-registered investment adviser"),
    },
    pages: [
      {
        key: "home",
        title: field("Home"),
        sections: [{ key: "hero", heading: field("Plan with clarity"), body: field("We help you plan.") }],
      },
    ],
    footer: {
      disclaimer: field("Registration does not imply a certain level of skill or training."),
      privacyNotice: field("We respect your privacy."),
      links: [
        { label: "Form ADV Part 2A", url: "https://x/adv2a.pdf", kind: "adv_2a" },
        { label: "Form ADV Part 2B", url: "https://x/adv2b.pdf", kind: "adv_2b" },
        { label: "Form CRS", url: "https://x/crs.pdf", kind: "crs" },
        { label: "Privacy Policy", url: "/privacy", kind: "privacy" },
      ],
    },
  };
}

const CTX: EvalContext = {
  schema: GENERATED_SITE_SCHEMA,
  prohibitedTerms: ["guarantee", "guaranteed", "promise", "no risk", "risk-free"],
  requiredDisclosures: [
    { id: "adv_2a", label: "Form ADV Part 2A", kind: "footer_link", linkKind: "adv_2a" },
    { id: "adv_2b", label: "Form ADV Part 2B", kind: "footer_link", linkKind: "adv_2b" },
    { id: "crs", label: "Form CRS", kind: "footer_link", linkKind: "crs" },
    { id: "privacy", label: "Privacy", kind: "footer_link", linkKind: "privacy" },
    { id: "disclaimer", label: "registration disclaimer", kind: "text", pattern: "registration does not imply" },
  ],
  promptContract: [
    { id: "ruleset", label: "ruleset in system prompt", pattern: "\\{\\{\\s*compliance_ruleset\\s*\\}\\}|compliance rulebook" },
    { id: "json", label: "JSON output", pattern: "json" },
    { id: "confidence", label: "confidence + sources", pattern: "confidence" },
  ],
};

const GOOD_PROMPT =
  "You generate an RIA site. Compliance rulebook: {{compliance_ruleset}}. " +
  "Respond ONLY in JSON matching the schema. Every field carries a confidence and sources.";
const BROKEN_PROMPT = "Write a nice website for the advisor.";

const ALL_OUTPUT_CHECKS = [
  "schema_valid",
  "no_prohibited_terms",
  "required_disclosures_present",
  "footer_contains_crs_link",
  "field_confidence_sources",
] as const;

function outputCase(name: string, output: unknown, expect: "pass" | "fail" = "pass"): EvalCase {
  return { name, kind: "output-property", expect, asserts: [...ALL_OUTPUT_CHECKS], output };
}

describe("runEval — output-property checks", () => {
  it("passes a fully-valid generated site on every check", () => {
    const res = runEval(outputCase("good", goodOutput()), CTX);
    expect(res.ok).toBe(true);
    expect(res.checks.every((c) => c.passed)).toBe(true);
  });

  it("flags prohibited terms in customer-visible copy (§18.2)", () => {
    const out = goodOutput();
    out.pages[0].sections[0].body = field("Our strategy is guaranteed to outperform.");
    const res = runEval(outputCase("prohibited", out), CTX);
    expect(res.ok).toBe(false);
    const check = res.checks.find((c) => c.check === "no_prohibited_terms");
    expect(check?.passed).toBe(false);
    expect(check?.detail).toMatch(/guaranteed/i);
  });

  it("does not false-positive on a prohibited term embedded in a larger word (compromise)", () => {
    const out = goodOutput();
    out.pages[0].sections[0].body = field("We never compromise on fiduciary duty.");
    const res = runEval(outputCase("compromise", out), CTX);
    expect(res.checks.find((c) => c.check === "no_prohibited_terms")?.passed).toBe(true);
  });

  it("fails footer_contains_crs_link when the CRS link is absent (§8.6 example)", () => {
    const out = goodOutput();
    out.footer.links = out.footer.links.filter((l) => l.kind !== "crs");
    const res = runEval(outputCase("no-crs", out), CTX);
    expect(res.ok).toBe(false);
    expect(res.checks.find((c) => c.check === "footer_contains_crs_link")?.passed).toBe(false);
  });

  it("fails required_disclosures_present and names the missing disclosure", () => {
    const out = goodOutput();
    out.footer.links = out.footer.links.filter((l) => l.kind !== "adv_2b");
    const res = runEval(outputCase("no-adv2b", out), CTX);
    const check = res.checks.find((c) => c.check === "required_disclosures_present");
    expect(check?.passed).toBe(false);
    expect(check?.detail).toMatch(/adv_2b|Form ADV Part 2B/i);
  });

  it("fails field_confidence_sources when any field lacks confidence/sources (§8.2.4)", () => {
    const out = goodOutput();
    delete (out.firm.name as Partial<GeneratedField>).confidence;
    const res = runEval(outputCase("no-confidence", out), CTX);
    expect(res.checks.find((c) => c.check === "field_confidence_sources")?.passed).toBe(false);
  });

  it("treats a negative case (expect:fail) as ok when the bad output IS caught", () => {
    const out = goodOutput();
    out.firm.tagline = field("We guarantee returns.");
    const negative: EvalCase = {
      ...outputCase("prohibited-negative", out, "fail"),
      asserts: ["no_prohibited_terms"],
    };
    const res = runEval(negative, CTX);
    expect(res.ok).toBe(true); // caught as expected
  });
});

describe("runEval — prompt-contract checks (§8.2)", () => {
  it("passes a prompt carrying the rulebook slot, JSON instruction, confidence", () => {
    const res = runEval(
      { name: "good-prompt", kind: "prompt-contract", expect: "pass", asserts: ["prompt_contract"], promptText: GOOD_PROMPT },
      CTX,
    );
    expect(res.ok).toBe(true);
  });

  it("fails a prompt missing the §8.2 markers (the gate bites on a bad prompt)", () => {
    const res = runEval(
      { name: "broken-prompt", kind: "prompt-contract", expect: "pass", asserts: ["prompt_contract"], promptText: BROKEN_PROMPT },
      CTX,
    );
    expect(res.ok).toBe(false);
    expect(res.checks[0].detail).toMatch(/ruleset|json|confidence/i);
  });

  it("a negative prompt-contract case (expect:fail) is ok when the broken prompt is rejected", () => {
    const res = runEval(
      { name: "broken-negative", kind: "prompt-contract", expect: "fail", asserts: ["prompt_contract"], promptText: BROKEN_PROMPT },
      CTX,
    );
    expect(res.ok).toBe(true);
  });

  it("honors a per-case contractRules override (so a validator prompt isn't held to generation markers)", () => {
    // A prompt with no "confidence" marker passes when the case only requires JSON.
    const res = runEval(
      {
        name: "validator-prompt",
        kind: "prompt-contract",
        expect: "pass",
        asserts: ["prompt_contract"],
        promptText: "Return a JSON verdict.",
        contractRules: [{ id: "json", label: "JSON", pattern: "json" }],
      },
      CTX,
    );
    expect(res.ok).toBe(true);
  });
});

describe("runEvals + formatReport", () => {
  it("aggregates pass/fail counts across cases", () => {
    const bad = goodOutput();
    bad.firm.name = field("Guaranteed best returns.");
    const report = runEvals(
      [outputCase("good", goodOutput()), outputCase("bad", bad)],
      CTX,
    );
    expect(report.total).toBe(2);
    expect(report.passed).toBe(1);
    expect(report.failed).toBe(1);
  });

  it("formats a per-case report with PASS/FAIL lines and failing-check detail", () => {
    const bad = goodOutput();
    bad.firm.name = field("Guaranteed returns.");
    const report = runEvals([outputCase("good", goodOutput()), outputCase("bad", bad)], CTX);
    const text = formatReport(report);
    expect(text).toMatch(/PASS\s+good/);
    expect(text).toMatch(/FAIL\s+bad/);
    expect(text).toMatch(/guaranteed/i);
  });
});
