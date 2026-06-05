import { describe, expect, it, vi } from "vitest";

import { parseRulesJson, resolveRuleset, type LoadedRuleset, type ResolvedRuleset } from "./ruleset";
import {
  LAYER2_VERDICT_SCHEMA,
  validateContent,
  validateDeterministic,
  type Layer2Gemini,
  type ValidationSubject,
} from "./validator";

const RAW_RULES = {
  industry: "ria",
  version: "1.0",
  status: "draft",
  prohibited_terms: [
    {
      id: "guarantee",
      terms: ["guarantee", "guaranteed", "guarantees"],
      severity: "high",
      match: "word",
      requires_substantiation: false,
      citation: "sec_marketing_rule",
      description: "Guarantees prohibited.",
    },
    {
      id: "no_risk",
      terms: ["no risk", "risk-free"],
      severity: "high",
      match: "word",
      requires_substantiation: false,
      citation: "sec_marketing_rule",
      description: "No-risk claims prohibited.",
    },
    {
      id: "unsubstantiated_superlatives",
      terms: ["best", "outperform"],
      severity: "medium",
      match: "word",
      requires_substantiation: true,
      citation: "sec_marketing_rule",
      description: "Superlatives prohibited unless substantiated.",
    },
  ],
  prohibited_content: [
    { id: "testimonials", description: "Testimonials disallowed.", severity: "high", citation: "sec_marketing_rule" },
  ],
  required_elements: [
    { id: "crs", label: "Form CRS", link_kind: "crs", placement: ["footer"], citation: "sec_form_crs" },
    { id: "adv_2a", label: "Form ADV Part 2A", link_kind: "adv_2a", placement: ["footer"], citation: "sec_form_adv_2a" },
  ],
  required_disclosures: [
    {
      id: "registration_no_skill",
      label: "Registration-does-not-imply disclaimer",
      template: "Registration does not imply a certain level of skill or training.",
      text_pattern: "registration does not imply",
      placement: ["footer"],
      citation: "sec_form_crs",
    },
  ],
  conditional_rules: [
    {
      id: "sec_registration_disclosure",
      when: { registration: "sec" },
      requires: [],
      template: "{{firm_name}} is an SEC-registered investment adviser.",
      applies_overlay: false,
      description: "",
      citation: "advisers_act",
    },
  ],
  citations: { sec_marketing_rule: { title: "x", url: "https://e.gov/x" }, sec_form_crs: { title: "y", url: "https://e.gov/y" }, sec_form_adv_2a: { title: "z", url: "https://e.gov/z" }, advisers_act: { title: "a", url: "https://e.gov/a" } },
};

function ruleset(): ResolvedRuleset {
  const loaded: LoadedRuleset = {
    industry: "ria",
    version: "1.0",
    rules: parseRulesJson(RAW_RULES),
    rulesMarkdown: "",
    footerTemplate: "",
    overlays: {},
  };
  return resolveRuleset(loaded, { registration: "sec", primaryState: null });
}

type Field = { value: string; confidence: number; sources: string[] };
type Section = { key: string; heading: Field; body: Field };
type Footer = { disclaimer: Field; privacyNotice: Field; links: Array<{ label: string; url: string; kind: string }> };
type Site = {
  schemaVersion: string;
  firm: { name: Field; tagline: Field; registration: Field };
  pages: Array<{ key: string; title: Field; sections: Section[] }>;
  footer: Footer;
};

/** A compliant site: CRS + ADV links present, disclaimer text present, no bad terms. */
function cleanSite(): Site {
  return {
    schemaVersion: "site.v1",
    firm: {
      name: { value: "Cedar Ridge Wealth", confidence: 0.9, sources: [] },
      tagline: { value: "Fee-only planning for families", confidence: 0.8, sources: [] },
      registration: { value: "Cedar Ridge is an SEC-registered investment adviser.", confidence: 0.9, sources: [] },
    },
    pages: [
      {
        key: "home",
        title: { value: "Home", confidence: 1, sources: [] },
        sections: [
          { key: "hero", heading: { value: "Plan with clarity", confidence: 0.8, sources: [] }, body: { value: "We help families build a plan they can stick with.", confidence: 0.7, sources: [] } },
        ],
      },
    ],
    footer: {
      disclaimer: { value: "Registration does not imply a certain level of skill or training.", confidence: 0.99, sources: [] },
      privacyNotice: { value: "We protect your information per Regulation S-P.", confidence: 0.9, sources: [] },
      links: [
        { label: "Form CRS", url: "https://e.gov/crs.pdf", kind: "crs" },
        { label: "Form ADV Part 2A", url: "https://e.gov/adv.pdf", kind: "adv_2a" },
      ],
    },
  };
}

const cleanSubject = (): ValidationSubject => ({ kind: "site", site: cleanSite() });

describe("validateDeterministic — clean site", () => {
  it("finds no violations on a compliant site", () => {
    expect(validateDeterministic(cleanSubject(), ruleset())).toEqual([]);
  });
});

describe("validateDeterministic — prohibited terms", () => {
  it("flags a hard prohibited term with the field path where it appears", () => {
    const site = cleanSite();
    site.pages[0].sections[0].body.value = "Our strategy is guaranteed to beat the market.";
    const violations = validateDeterministic({ kind: "site", site }, ruleset());
    const v = violations.find((x) => x.ruleId === "guarantee");
    expect(v).toBeDefined();
    expect(v?.severity).toBe("high");
    expect(v?.fieldPath).toMatch(/pages\[0\]\.sections\[0\]\.body/);
    expect(v?.source).toBe("deterministic");
  });

  it("does NOT flag a context-dependent superlative (left to the AI pass)", () => {
    const site = cleanSite();
    site.pages[0].sections[0].body.value = "We strive to be the best partner for your goals.";
    const violations = validateDeterministic({ kind: "site", site }, ruleset());
    expect(violations.some((v) => v.ruleId === "unsubstantiated_superlatives")).toBe(false);
  });

  it("uses word boundaries so 'no risk' matches but a substring does not false-positive", () => {
    const site = cleanSite();
    site.pages[0].sections[0].body.value = "This is a no risk investment.";
    const violations = validateDeterministic({ kind: "site", site }, ruleset());
    expect(violations.some((v) => v.ruleId === "no_risk")).toBe(true);
  });
});

describe("validateDeterministic — required elements & disclosures (site scope)", () => {
  it("flags a missing required footer link", () => {
    const site = cleanSite();
    site.footer.links = [{ label: "Form ADV Part 2A", url: "https://e.gov/adv.pdf", kind: "adv_2a" }];
    const violations = validateDeterministic({ kind: "site", site }, ruleset());
    const v = violations.find((x) => x.ruleId === "crs");
    expect(v).toBeDefined();
    expect(v?.fieldPath).toBe("footer.links");
  });

  it("flags a missing required disclosure", () => {
    const site = cleanSite();
    site.footer.disclaimer.value = "Some footer text without the mandated language.";
    const violations = validateDeterministic({ kind: "site", site }, ruleset());
    expect(violations.some((v) => v.ruleId === "registration_no_skill")).toBe(true);
  });
});

describe("validateDeterministic — fragment scope", () => {
  it("scans prohibited terms but does NOT require footer elements", () => {
    const subject: ValidationSubject = { kind: "fragment", text: "We guarantee returns.", label: "blog:post-1" };
    const violations = validateDeterministic(subject, ruleset());
    expect(violations.some((v) => v.ruleId === "guarantee")).toBe(true);
    // A blog fragment is not the footer — missing CRS link must NOT be flagged.
    expect(violations.some((v) => v.ruleId === "crs")).toBe(false);
    expect(violations.some((v) => v.ruleId === "registration_no_skill")).toBe(false);
  });
});

describe("validateContent — orchestration", () => {
  it("deterministic-only when no gemini client: passes a clean site, aiPassRan=false", async () => {
    const result = await validateContent({ subject: cleanSubject(), ruleset: ruleset() });
    expect(result.verdict).toBe("pass");
    expect(result.violations).toEqual([]);
    expect(result.aiPassRan).toBe(false);
    expect(result.rulesetVersion).toBe("ria/v1.0");
  });

  it("fails when the deterministic pass finds a violation", async () => {
    const site = cleanSite();
    site.footer.links = [];
    const result = await validateContent({ subject: { kind: "site", site }, ruleset: ruleset() });
    expect(result.verdict).toBe("fail");
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it("runs the AI pass when a gemini client is provided and merges its violations", async () => {
    const gemini: Layer2Gemini = {
      generateJSON: vi.fn().mockResolvedValue({
        data: {
          verdict: "fail",
          violations: [
            { rule_id: "testimonials", severity: "high", excerpt: "Best advisor ever! - A client", explanation: "Client testimonial present." },
          ],
        },
        model: "gemini-2.5-flash",
        usage: { inputTokens: 100, outputTokens: 20 },
        costUsd: 0,
      }),
    };
    const result = await validateContent({
      subject: cleanSubject(),
      ruleset: ruleset(),
      gemini,
      layer2PromptText: "Scan strictly against: {{compliance_ruleset}}",
    });
    expect(result.aiPassRan).toBe(true);
    expect(gemini.generateJSON).toHaveBeenCalledOnce();
    const aiViolation = result.violations.find((v) => v.ruleId === "testimonials");
    expect(aiViolation).toBeDefined();
    expect(aiViolation?.source).toBe("ai");
    expect(result.verdict).toBe("fail");
  });

  it("dedups an AI violation whose rule the deterministic pass already caught", async () => {
    const site = cleanSite();
    site.pages[0].sections[0].body.value = "Returns are guaranteed.";
    const gemini: Layer2Gemini = {
      generateJSON: vi.fn().mockResolvedValue({
        data: { verdict: "fail", violations: [{ rule_id: "guarantee", severity: "high", excerpt: "guaranteed", explanation: "dup" }] },
        model: "gemini-2.5-flash",
        usage: { inputTokens: 1, outputTokens: 1 },
        costUsd: 0,
      }),
    };
    const result = await validateContent({
      subject: { kind: "site", site },
      ruleset: ruleset(),
      gemini,
      layer2PromptText: "{{compliance_ruleset}}",
    });
    expect(result.violations.filter((v) => v.ruleId === "guarantee")).toHaveLength(1);
    expect(result.violations.find((v) => v.ruleId === "guarantee")?.source).toBe("deterministic");
  });
});

describe("LAYER2_VERDICT_SCHEMA", () => {
  it("parses a well-formed verdict", () => {
    const parsed = LAYER2_VERDICT_SCHEMA.parse({
      verdict: "fail",
      violations: [{ rule_id: "guarantee", severity: "high", excerpt: "guaranteed", explanation: "no guarantees" }],
    });
    expect(parsed.verdict).toBe("fail");
    expect(parsed.violations).toHaveLength(1);
  });

  it("defaults a missing violations array to empty for a pass verdict", () => {
    const parsed = LAYER2_VERDICT_SCHEMA.parse({ verdict: "pass" });
    expect(parsed.violations).toEqual([]);
  });

  it("throws on an invalid verdict value", () => {
    expect(() => LAYER2_VERDICT_SCHEMA.parse({ verdict: "maybe" })).toThrow();
  });
});
