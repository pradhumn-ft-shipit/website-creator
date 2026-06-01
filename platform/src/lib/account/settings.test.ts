import { describe, expect, it } from "vitest";

import {
  DELETION_GRACE_DAYS,
  LEAD_FREQUENCIES,
  deletionState,
  isLeadFrequency,
  validateFirmName,
  validateFullName,
} from "./settings";

describe("validateFullName", () => {
  it("accepts a normal name", () => {
    expect(validateFullName("Jane Q. Advisor")).toBeNull();
  });

  it("accepts empty (the field is optional / clearable)", () => {
    expect(validateFullName("")).toBeNull();
    expect(validateFullName("   ")).toBeNull();
  });

  it("rejects an over-long name", () => {
    expect(validateFullName("a".repeat(121))).toMatch(/120 characters/);
  });
});

describe("validateFirmName", () => {
  it("accepts a normal firm name", () => {
    expect(validateFirmName("Cedar Ridge Wealth")).toBeNull();
  });

  it("rejects an over-long firm name", () => {
    expect(validateFirmName("a".repeat(201))).toMatch(/200 characters/);
  });
});

describe("isLeadFrequency", () => {
  it("recognizes the three valid frequencies", () => {
    for (const f of LEAD_FREQUENCIES) expect(isLeadFrequency(f)).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isLeadFrequency("hourly")).toBe(false);
    expect(isLeadFrequency("")).toBe(false);
    expect(isLeadFrequency(null)).toBe(false);
  });
});

describe("deletionState", () => {
  it("is not pending when no deletion was requested", () => {
    const state = deletionState(null, new Date("2026-06-01T00:00:00Z"));
    expect(state.pending).toBe(false);
    expect(state.graceEndsAt).toBeNull();
    expect(state.daysRemaining).toBeNull();
  });

  it("computes a 30-day grace window from the request time", () => {
    const requestedAt = "2026-06-01T00:00:00Z";
    const state = deletionState(requestedAt, new Date("2026-06-01T00:00:00Z"));
    expect(state.pending).toBe(true);
    // 30 days after the request.
    expect(state.graceEndsAt).toBe("2026-07-01T00:00:00.000Z");
    expect(state.daysRemaining).toBe(DELETION_GRACE_DAYS);
  });

  it("counts down whole days remaining as the window elapses", () => {
    const requestedAt = "2026-06-01T00:00:00Z";
    // 10 days in → 20 left.
    const state = deletionState(requestedAt, new Date("2026-06-11T00:00:00Z"));
    expect(state.daysRemaining).toBe(20);
  });

  it("never reports negative days once the window has passed", () => {
    const requestedAt = "2026-06-01T00:00:00Z";
    const state = deletionState(requestedAt, new Date("2026-08-01T00:00:00Z"));
    expect(state.daysRemaining).toBe(0);
  });

  it("rounds up a partial final day so the count reaches zero only at expiry", () => {
    const requestedAt = "2026-06-01T00:00:00Z";
    // 29.5 days in → still 1 day shown, not 0.
    const state = deletionState(requestedAt, new Date("2026-06-30T12:00:00Z"));
    expect(state.daysRemaining).toBe(1);
  });
});
