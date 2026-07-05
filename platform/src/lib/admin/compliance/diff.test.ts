import { describe, expect, it } from "vitest";

import { parseRulesJson } from "@/lib/compliance";
import { diffRulesets } from "./diff";

const BASE = {
  industry: "ria",
  version: "1.0",
  status: "draft",
  prohibited_terms: [
    { id: "guarantee", terms: ["guaranteed", "guarantee"], severity: "high", match: "word", requires_substantiation: false, citation: "sec-206" },
  ],
  prohibited_content: [
    { id: "testimonials", description: "No client testimonials.", severity: "high", citation: "sec-206-4-1" },
  ],
  required_elements: [
    { id: "adv-2a", label: "Form ADV Part 2A", link_kind: "adv_2a", placement: ["footer"], citation: "adv" },
  ],
  required_disclosures: [
    { id: "reg-line", label: "Registration line", template: "X is an SEC-registered adviser.", text_pattern: "registered", placement: ["footer"], citation: "adv" },
  ],
  conditional_rules: [
    { id: "sec-reg", when: { registration: "sec" }, requires: ["reg-line"], template: "SEC line", applies_overlay: false, description: "", citation: "adv" },
  ],
  citations: {
    "sec-206": { title: "Advisers Act §206", url: "https://sec.gov/206" },
    "sec-206-4-1": { title: "Rule 206(4)-1", url: "https://sec.gov/marketing" },
    adv: { title: "Form ADV", url: "https://sec.gov/adv" },
  },
};

function clone() {
  return JSON.parse(JSON.stringify(BASE));
}

describe("diffRulesets", () => {
  it("reports no changes for identical rulesets", () => {
    const diff = diffRulesets(parseRulesJson(clone()), parseRulesJson(clone()));
    expect(diff.identical).toBe(true);
    expect(diff.totals).toEqual({ added: 0, removed: 0, changed: 0 });
  });

  it("detects an added prohibited-term group", () => {
    const after = clone();
    after.prohibited_terms.push({
      id: "no-risk", terms: ["no risk", "risk-free"], severity: "high", match: "substring", requires_substantiation: false, citation: "sec-206",
    });
    const diff = diffRulesets(parseRulesJson(clone()), parseRulesJson(after));
    expect(diff.totals.added).toBe(1);
    const change = diff.categories.prohibitedTerms.find((c) => c.id === "no-risk");
    expect(change?.kind).toBe("added");
    expect(change?.label).toBe("no risk, risk-free");
    expect(change?.before).toBeNull();
  });

  it("detects a removed required element", () => {
    const after = clone();
    after.required_elements = [];
    const diff = diffRulesets(parseRulesJson(clone()), parseRulesJson(after));
    expect(diff.totals.removed).toBe(1);
    expect(diff.categories.requiredElements[0]).toMatchObject({ id: "adv-2a", kind: "removed", after: null });
  });

  it("detects a changed rule body (severity bumped)", () => {
    const after = clone();
    after.prohibited_content[0].severity = "medium";
    const diff = diffRulesets(parseRulesJson(clone()), parseRulesJson(after));
    expect(diff.totals.changed).toBe(1);
    const change = diff.categories.prohibitedContent[0];
    expect(change.kind).toBe("changed");
    expect((change.before as { severity: string }).severity).toBe("high");
    expect((change.after as { severity: string }).severity).toBe("medium");
  });

  it("diffs the citations map by key", () => {
    const after = clone();
    after.citations["new-cite"] = { title: "New rule", url: "https://sec.gov/new" };
    const diff = diffRulesets(parseRulesJson(clone()), parseRulesJson(after));
    expect(diff.categories.citations.some((c) => c.id === "new-cite" && c.kind === "added")).toBe(true);
  });
});
