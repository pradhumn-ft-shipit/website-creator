import { describe, expect, it } from "vitest";

import { normalizeWaitlistEmail, validateWaitlist } from "./validate";

describe("validateWaitlist", () => {
  it("accepts a valid email on a non-RIA industry", () => {
    expect(
      validateWaitlist({ email: "advisor@firm.com", industry: "insurance" }),
    ).toBeNull();
  });

  it("rejects a malformed email", () => {
    expect(
      validateWaitlist({ email: "not-an-email", industry: "law" }),
    ).toMatch(/email/i);
  });

  it("rejects RIA — it's live, not a waitlist industry", () => {
    expect(
      validateWaitlist({ email: "advisor@firm.com", industry: "ria" }),
    ).toMatch(/industry/i);
  });

  it("rejects an unknown industry", () => {
    expect(
      validateWaitlist({ email: "advisor@firm.com", industry: "dentistry" }),
    ).toMatch(/industry/i);
  });

  it("accepts each of the four non-RIA industries", () => {
    for (const industry of ["insurance", "mortgage", "law", "real_estate"]) {
      expect(validateWaitlist({ email: "a@b.com", industry })).toBeNull();
    }
  });
});

describe("normalizeWaitlistEmail", () => {
  it("lowercases and trims so duplicates collapse", () => {
    expect(normalizeWaitlistEmail("  Advisor@Firm.com ")).toBe(
      "advisor@firm.com",
    );
  });
});
