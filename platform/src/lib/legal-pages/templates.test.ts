import { describe, expect, it } from "vitest";

import {
  build404Page,
  buildLegalPages,
  buildPrivacyPolicy,
  buildTermsOfService,
  type LegalPageContext,
} from "./templates";

const secCtx: LegalPageContext = {
  firmName: "Cedar Ridge Advisors",
  registration: "sec",
  state: "NY",
  industry: "ria",
};

const caStateCtx: LegalPageContext = {
  firmName: "Golden Gate Wealth",
  registration: "state",
  state: "CA",
  industry: "ria",
};

describe("buildPrivacyPolicy (§14.1, Reg S-P aware)", () => {
  it("names the firm and covers contact-form data collection", () => {
    const page = buildPrivacyPolicy(secCtx);
    expect(page.bodyMarkdown).toContain("Cedar Ridge Advisors");
    expect(page.bodyMarkdown.toLowerCase()).toContain("contact form");
    // Reg S-P is the RIA-specific privacy rule for nonpublic personal info.
    expect(page.bodyMarkdown).toContain("Regulation S-P");
  });

  it("is a REQUIRED, non-removable page (§4.4)", () => {
    const page = buildPrivacyPolicy(secCtx);
    expect(page.required).toBe(true);
    expect(page.removable).toBe(false);
    expect(page.slug).toBe("privacy");
  });

  it("produces STATE-SPECIFIC copy: California surfaces CCPA/CPRA", () => {
    const ca = buildPrivacyPolicy(caStateCtx);
    const ny = buildPrivacyPolicy(secCtx);
    expect(ca.bodyMarkdown).toContain("California");
    expect(ca.bodyMarkdown).toMatch(/CCPA|CPRA/);
    // The two states must not render identical privacy copy.
    expect(ca.bodyMarkdown).not.toBe(ny.bodyMarkdown);
  });

  it("names the state of registration for a state-registered adviser", () => {
    const ca = buildPrivacyPolicy(caStateCtx);
    expect(ca.bodyMarkdown).toContain("State of California");
  });
});

describe("buildTermsOfService (§14.1 disclaimer + limitations)", () => {
  it("includes the §14.1 informational-only + no-advice + limited-liability language", () => {
    const page = buildTermsOfService(secCtx);
    const body = page.bodyMarkdown.toLowerCase();
    expect(body).toContain("informational purposes only");
    expect(body).toContain("does not constitute");
    expect(body).toMatch(/no (investment )?advice/);
    expect(body).toContain("limitation of liability");
  });

  it("is a REQUIRED, non-removable page", () => {
    const page = buildTermsOfService(secCtx);
    expect(page.required).toBe(true);
    expect(page.removable).toBe(false);
    expect(page.slug).toBe("terms");
  });
});

describe("build404Page (§6.9 hygiene)", () => {
  it("has a heading, a back-home link, and a search prompt", () => {
    const page = build404Page();
    expect(page.slug).toBe("not-found");
    if (page.content.kind !== "not_found") throw new Error("expected not_found content");
    expect(page.content.backHomeHref).toBe("/");
    expect(page.content.backHomeLabel.toLowerCase()).toContain("home");
    expect(page.content.searchPrompt).toBeTruthy();
    expect(page.content.heading).toBeTruthy();
  });

  it("is a hygiene page (not compliance-required, but still shipped)", () => {
    const page = build404Page();
    expect(page.required).toBe(false);
  });
});

describe("buildLegalPages — the full set consumable by the build (024)", () => {
  it("returns privacy + terms + 404, with privacy/terms required", () => {
    const pages = buildLegalPages(secCtx);
    const slugs = pages.map((p) => p.slug).sort();
    expect(slugs).toEqual(["not-found", "privacy", "terms"]);
    const required = pages.filter((p) => p.required).map((p) => p.slug).sort();
    expect(required).toEqual(["privacy", "terms"]);
  });
});
