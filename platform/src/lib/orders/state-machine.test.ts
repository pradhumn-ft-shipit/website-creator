import { describe, it, expect } from "vitest";

import {
  ORDERED_STATES,
  IllegalTransitionError,
  canTransition,
  assertTransition,
  positionOf,
  isFailureState,
  layer3Required,
  nextStateAfter,
} from "./state-machine";

describe("ORDERED_STATES (§18.1)", () => {
  it("encodes the full happy-path state list in order", () => {
    expect(ORDERED_STATES).toEqual([
      "payment_received",
      "scraping",
      "scrape_complete",
      "scrape_failed",
      "docs_upload_fallback",
      "onboarding_in_progress",
      "onboarding_complete",
      "generating_copy",
      "copy_review",
      "copy_approved",
      "compliance_review_layer2",
      "compliance_review_layer3",
      "building",
      "deploying",
      "deployed",
      "email_sent",
      "live",
      "dns_monitoring",
      // failure states
      "generation_failed",
      "validation_failed",
      "build_failed",
      "deploy_failed",
    ]);
  });

  it("positionOf returns the index of a state", () => {
    expect(positionOf("payment_received")).toBe(0);
    expect(positionOf("scraping")).toBe(1);
    expect(positionOf("live")).toBe(16);
  });
});

describe("canTransition (legal paths)", () => {
  it("allows payment_received → scraping", () => {
    expect(canTransition("payment_received", "scraping")).toBe(true);
  });

  it("allows scraping → scrape_complete and scraping → scrape_failed", () => {
    expect(canTransition("scraping", "scrape_complete")).toBe(true);
    expect(canTransition("scraping", "scrape_failed")).toBe(true);
  });

  it("allows the scrape_failed fallback branch", () => {
    expect(canTransition("scrape_failed", "docs_upload_fallback")).toBe(true);
    expect(canTransition("docs_upload_fallback", "onboarding_in_progress")).toBe(
      true,
    );
  });

  it("allows scrape_complete → onboarding_in_progress", () => {
    expect(canTransition("scrape_complete", "onboarding_in_progress")).toBe(
      true,
    );
  });

  it("allows the conditional Layer-2 → Layer-3 → building branch", () => {
    expect(
      canTransition("compliance_review_layer2", "compliance_review_layer3"),
    ).toBe(true);
    // Layer 2 may skip Layer 3 and go straight to building
    expect(canTransition("compliance_review_layer2", "building")).toBe(true);
    expect(canTransition("compliance_review_layer3", "building")).toBe(true);
  });

  it("allows the full deploy tail", () => {
    expect(canTransition("building", "deploying")).toBe(true);
    expect(canTransition("deploying", "deployed")).toBe(true);
    expect(canTransition("deployed", "email_sent")).toBe(true);
    expect(canTransition("email_sent", "live")).toBe(true);
    expect(canTransition("live", "dns_monitoring")).toBe(true);
  });

  it("allows transitions into failure states from their stage", () => {
    expect(canTransition("generating_copy", "generation_failed")).toBe(true);
    expect(canTransition("compliance_review_layer2", "validation_failed")).toBe(
      true,
    );
    expect(canTransition("building", "build_failed")).toBe(true);
    expect(canTransition("deploying", "deploy_failed")).toBe(true);
  });
});

describe("canTransition (illegal paths)", () => {
  it("rejects skipping ahead", () => {
    expect(canTransition("payment_received", "building")).toBe(false);
  });

  it("rejects going backwards on the happy path", () => {
    expect(canTransition("live", "building")).toBe(false);
  });

  it("rejects a made-up transition", () => {
    expect(canTransition("deployed", "scraping")).toBe(false);
  });
});

describe("assertTransition", () => {
  it("returns the target state on a legal transition", () => {
    expect(assertTransition("payment_received", "scraping")).toBe("scraping");
  });

  it("throws IllegalTransitionError on an illegal transition", () => {
    expect(() => assertTransition("payment_received", "live")).toThrow(
      IllegalTransitionError,
    );
  });

  it("the thrown error carries from/to", () => {
    try {
      assertTransition("payment_received", "live");
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(IllegalTransitionError);
      const e = err as IllegalTransitionError;
      expect(e.from).toBe("payment_received");
      expect(e.to).toBe("live");
    }
  });
});

describe("isFailureState", () => {
  it("identifies failure states", () => {
    expect(isFailureState("scrape_failed")).toBe(true);
    expect(isFailureState("generation_failed")).toBe(true);
    expect(isFailureState("validation_failed")).toBe(true);
    expect(isFailureState("build_failed")).toBe(true);
    expect(isFailureState("deploy_failed")).toBe(true);
  });

  it("does not flag happy-path states", () => {
    expect(isFailureState("live")).toBe(false);
    expect(isFailureState("building")).toBe(false);
  });
});

describe("layer3Required (Q4c — §5.2/§13.3 gating predicate)", () => {
  it("requires Layer 3 when Layer 2 verdict is flag", () => {
    expect(layer3Required({ verdict: "flag", siteIndex: 999 })).toBe(true);
  });

  it("requires Layer 3 for the first 50 sites regardless of verdict", () => {
    expect(layer3Required({ verdict: "pass", siteIndex: 0 })).toBe(true);
    expect(layer3Required({ verdict: "pass", siteIndex: 49 })).toBe(true);
  });

  it("skips Layer 3 for a passing verdict beyond the first 50 sites", () => {
    expect(layer3Required({ verdict: "pass", siteIndex: 50 })).toBe(false);
    expect(layer3Required({ verdict: "warn", siteIndex: 100 })).toBe(false);
  });
});

describe("nextStateAfter (Layer-2 routing helper)", () => {
  it("routes to Layer 3 when required", () => {
    expect(
      nextStateAfter("compliance_review_layer2", {
        verdict: "flag",
        siteIndex: 10,
      }),
    ).toBe("compliance_review_layer3");
  });

  it("skips straight to building when Layer 3 not required", () => {
    expect(
      nextStateAfter("compliance_review_layer2", {
        verdict: "pass",
        siteIndex: 200,
      }),
    ).toBe("building");
  });
});
