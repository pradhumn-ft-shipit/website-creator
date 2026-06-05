import { describe, expect, it } from "vitest";

import {
  INDUSTRIES,
  ONBOARDING_STEPS,
  RIA_SUB_CLASS,
  isLiveIndustry,
  resolveResumeStep,
  stepProgress,
  validateSubClass,
} from "./steps";

describe("INDUSTRIES", () => {
  it("lists the five PRD §2.2 industry cards", () => {
    expect(INDUSTRIES.map((i) => i.key)).toEqual([
      "ria",
      "insurance",
      "mortgage",
      "law",
      "real_estate",
    ]);
  });

  it("marks only RIA as live in v1; the other four are waitlist-only", () => {
    expect(isLiveIndustry("ria")).toBe(true);
    for (const key of ["insurance", "mortgage", "law", "real_estate"]) {
      expect(isLiveIndustry(key)).toBe(false);
    }
  });

  it("treats an unknown industry as not live", () => {
    expect(isLiveIndustry("dentistry")).toBe(false);
  });
});

describe("resolveResumeStep", () => {
  it("starts at industry when nothing is chosen yet", () => {
    expect(
      resolveResumeStep({ industry: null, subIndustry: null, hasOrder: false }),
    ).toBe("industry");
  });

  it("resumes at subclass once RIA is chosen but sub-class isn't confirmed", () => {
    expect(
      resolveResumeStep({ industry: "ria", subIndustry: null, hasOrder: false }),
    ).toBe("subclass");
  });

  it("resumes at payment once industry + sub-class are set and no order exists", () => {
    expect(
      resolveResumeStep({
        industry: "ria",
        subIndustry: "ria_only",
        hasOrder: false,
      }),
    ).toBe("payment");
  });

  it("lands on handoff once an order exists (pipeline already kicked off)", () => {
    expect(
      resolveResumeStep({
        industry: "ria",
        subIndustry: "ria_only",
        hasOrder: true,
      }),
    ).toBe("handoff");
  });

  it("treats an existing order as authoritative even if a field looks unset", () => {
    expect(
      resolveResumeStep({ industry: "ria", subIndustry: null, hasOrder: true }),
    ).toBe("handoff");
  });
});

describe("validateSubClass", () => {
  it("accepts the only v1 sub-class", () => {
    expect(validateSubClass(RIA_SUB_CLASS)).toBeNull();
  });

  it("rejects anything else (BD-affiliated etc. are out of v1 scope)", () => {
    expect(validateSubClass("bd_affiliated")).toMatch(/RIA-only/);
    expect(validateSubClass("")).toMatch(/RIA-only/);
  });
});

describe("stepProgress", () => {
  it("numbers the three input steps 1..3 of 3", () => {
    expect(stepProgress("industry")).toEqual({ current: 1, total: 3 });
    expect(stepProgress("subclass")).toEqual({ current: 2, total: 3 });
    expect(stepProgress("payment")).toEqual({ current: 3, total: 3 });
  });

  it("reports handoff as complete (all steps done)", () => {
    expect(stepProgress("handoff")).toEqual({ current: 3, total: 3 });
  });

  it("exposes the three input steps in order", () => {
    expect(ONBOARDING_STEPS).toEqual(["industry", "subclass", "payment"]);
  });
});
