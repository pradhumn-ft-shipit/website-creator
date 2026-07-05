import { describe, expect, it } from "vitest";

import { runLayer2 } from "@/lib/compliance";

import { legalContextFromAccount } from "./service";
import { buildPrivacyPolicy, buildTermsOfService } from "./templates";

describe("legalContextFromAccount", () => {
  it("maps a state-registered RIA account to a state registration context", () => {
    const ctx = legalContextFromAccount({
      firm_name: "Golden Gate Wealth",
      sub_industry: "ria_state",
      primary_state: "CA",
      industry: "ria",
    });
    expect(ctx).toMatchObject({
      firmName: "Golden Gate Wealth",
      registration: "state",
      state: "CA",
      industry: "ria",
    });
  });

  it("maps an SEC RIA (or unknown sub_industry) to an SEC registration context", () => {
    expect(
      legalContextFromAccount({
        firm_name: "Cedar Ridge",
        sub_industry: "ria_sec",
        primary_state: "NY",
        industry: "ria",
      }).registration,
    ).toBe("sec");
    expect(
      legalContextFromAccount({
        firm_name: null,
        sub_industry: null,
        primary_state: null,
        industry: "ria",
      }).registration,
    ).toBe("sec");
  });

  it("falls back to a safe firm placeholder when firm_name is missing", () => {
    const ctx = legalContextFromAccount({
      firm_name: null,
      sub_industry: "ria_sec",
      primary_state: "NY",
      industry: "ria",
    });
    expect(ctx.firmName.length).toBeGreaterThan(0);
  });
});

// Build-loop step 6: the Layer-2 validator must pass over the generated legal
// copy. Runs deterministically against the REAL ria/v1.0 ruleset (no Gemini).
describe("generated legal copy passes Layer-2 (deterministic)", () => {
  const ctx = {
    firmName: "Cedar Ridge Advisors",
    registration: "sec" as const,
    state: "NY",
    industry: "ria" as const,
  };

  it("privacy policy has no prohibited terms", async () => {
    const page = buildPrivacyPolicy(ctx);
    const result = await runLayer2({
      subject: { kind: "fragment", text: page.bodyMarkdown, label: "privacy" },
      registration: "sec",
      primaryState: "NY",
    });
    expect(result.verdict).toBe("pass");
    expect(result.violations).toHaveLength(0);
  });

  it("terms of service has no prohibited terms", async () => {
    const page = buildTermsOfService(ctx);
    const result = await runLayer2({
      subject: { kind: "fragment", text: page.bodyMarkdown, label: "terms" },
      registration: "sec",
      primaryState: "NY",
    });
    expect(result.verdict).toBe("pass");
    expect(result.violations).toHaveLength(0);
  });
});
