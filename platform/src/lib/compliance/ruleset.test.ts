import { describe, expect, it } from "vitest";

import {
  buildRulesetPrompt,
  parseRulesJson,
  resolveRuleset,
  rulesetVersionString,
  type LoadedRuleset,
} from "./ruleset";

/** A representative slice of the authored ria/v1.0 rules.json (snake_case as on disk). */
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
      description: "Guarantees of performance are prohibited.",
    },
    {
      id: "unsubstantiated_superlatives",
      terms: ["best", "top-ranked", "outperform"],
      severity: "medium",
      match: "word",
      requires_substantiation: true,
      citation: "sec_marketing_rule",
      description: "Superlatives prohibited unless substantiated.",
    },
  ],
  prohibited_content: [
    {
      id: "testimonials",
      description: "Client testimonials are disallowed entirely in WRI v1.",
      severity: "high",
      citation: "sec_marketing_rule",
    },
  ],
  required_elements: [
    {
      id: "crs",
      label: "Form CRS (Customer Relationship Summary)",
      link_kind: "crs",
      placement: ["footer", "page"],
      citation: "sec_form_crs",
    },
  ],
  required_disclosures: [
    {
      id: "registration_no_skill",
      label: "Registration-does-not-imply-skill disclaimer",
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
      requires: ["sec_registration_statement"],
      template: "{{firm_name}} is an SEC-registered investment adviser.",
      applies_overlay: false,
      description: "SEC registration line.",
      citation: "advisers_act",
    },
    {
      id: "state_registration_disclosure",
      when: { registration: "state" },
      requires: ["state_registration_statement"],
      template: "{{firm_name}} is a state-registered investment adviser registered with the {{state}} securities regulator.",
      applies_overlay: true,
      description: "State registration line.",
      citation: "nasaa_state",
    },
  ],
  citations: {
    sec_marketing_rule: { title: "SEC Marketing Rule", url: "https://example.gov/marketing" },
    sec_form_crs: { title: "Form CRS", url: "https://example.gov/crs" },
    advisers_act: { title: "Advisers Act", url: "https://example.gov/act" },
    nasaa_state: { title: "NASAA state", url: "https://example.gov/state" },
  },
};

function loaded(): LoadedRuleset {
  return {
    industry: "ria",
    version: "1.0",
    rules: parseRulesJson(RAW_RULES),
    rulesMarkdown: "# RIA ruleset\n",
    footerTemplate: "{{firm_name}} footer",
    overlays: {
      CA: "# California overlay\nRegistered with the California DFPI.",
    },
  };
}

describe("parseRulesJson", () => {
  it("maps snake_case rules.json into the typed camelCase ruleset", () => {
    const rules = parseRulesJson(RAW_RULES);
    expect(rules.industry).toBe("ria");
    expect(rules.version).toBe("1.0");
    expect(rules.prohibitedTerms).toHaveLength(2);
    expect(rules.prohibitedTerms[0]).toMatchObject({
      id: "guarantee",
      terms: ["guarantee", "guaranteed", "guarantees"],
      severity: "high",
      match: "word",
      requiresSubstantiation: false,
    });
    expect(rules.prohibitedTerms[1].requiresSubstantiation).toBe(true);
    expect(rules.requiredElements[0]).toMatchObject({ id: "crs", linkKind: "crs" });
    expect(rules.requiredDisclosures[0]).toMatchObject({
      id: "registration_no_skill",
      textPattern: "registration does not imply",
    });
    expect(rules.conditionalRules[1]).toMatchObject({
      id: "state_registration_disclosure",
      appliesOverlay: true,
    });
    expect(rules.conditionalRules[1].when.registration).toBe("state");
  });

  it("throws a path-qualified error on a malformed ruleset", () => {
    const bad = { ...RAW_RULES, prohibited_terms: [{ id: "x" }] };
    expect(() => parseRulesJson(bad)).toThrow(/prohibited_terms\[0\]/);
  });

  it("rejects a non-object input", () => {
    expect(() => parseRulesJson(null)).toThrow(/rules/);
  });
});

describe("rulesetVersionString", () => {
  it("formats industry + version as the path-style version string", () => {
    expect(rulesetVersionString("ria", "1.0")).toBe("ria/v1.0");
  });
});

describe("resolveRuleset", () => {
  it("for an SEC-registered adviser applies no state overlay", () => {
    const resolved = resolveRuleset(loaded(), { registration: "sec", primaryState: "CA" });
    expect(resolved.versionString).toBe("ria/v1.0");
    expect(resolved.registration).toBe("sec");
    expect(resolved.overlay).toBeNull();
  });

  it("for a state-registered adviser applies the matching state overlay (case-insensitive)", () => {
    const resolved = resolveRuleset(loaded(), { registration: "state", primaryState: "ca" });
    expect(resolved.overlay).not.toBeNull();
    expect(resolved.overlay?.state).toBe("CA");
    expect(resolved.overlay?.text).toMatch(/California DFPI/);
  });

  it("for a state-registered adviser with no overlay on file leaves overlay null", () => {
    const resolved = resolveRuleset(loaded(), { registration: "state", primaryState: "WY" });
    expect(resolved.overlay).toBeNull();
  });
});

describe("buildRulesetPrompt", () => {
  it("emits a compact authoritative block carrying terms, content, elements, and the registration line", () => {
    const resolved = resolveRuleset(loaded(), { registration: "sec", primaryState: null });
    const text = resolved.promptText;
    expect(text).toMatch(/guarantee/);
    expect(text).toMatch(/testimonials/i);
    expect(text).toMatch(/Form CRS/);
    expect(text).toMatch(/registration does not imply/i);
    expect(text).toMatch(/SEC-registered/);
  });

  it("includes the state overlay text when one is applied", () => {
    const resolved = resolveRuleset(loaded(), { registration: "state", primaryState: "CA" });
    expect(resolved.promptText).toMatch(/California DFPI/);
  });

  it("is callable directly on rules for a given registration", () => {
    const text = buildRulesetPrompt(parseRulesJson(RAW_RULES), {
      registration: "state",
      overlayText: null,
    });
    expect(text).toMatch(/state-registered/);
  });
});
