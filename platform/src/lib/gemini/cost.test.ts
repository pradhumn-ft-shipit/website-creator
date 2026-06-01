import { describe, expect, it } from "vitest";

import {
  CostAccumulator,
  estimateCostUsd,
  PER_SITE_COST_CAP_USD,
} from "./cost";
import { CostBudgetExceededError } from "./errors";
import { GEMINI_MODELS, PRICING } from "./models";

describe("estimateCostUsd", () => {
  it("computes cost from the pricing table", () => {
    // 1M input + 1M output on Flash = input rate + output rate.
    const cost = estimateCostUsd(GEMINI_MODELS.flash, {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(
      PRICING[GEMINI_MODELS.flash].inputPerMillion +
        PRICING[GEMINI_MODELS.flash].outputPerMillion,
      6,
    );
  });

  it("a full-site Pro generation at budget stays well under $2", () => {
    // §8.4 targets: 30k in, 12k out on Pro.
    const cost = estimateCostUsd(GEMINI_MODELS.pro, {
      inputTokens: 30_000,
      outputTokens: 12_000,
    });
    expect(cost).toBeLessThan(PER_SITE_COST_CAP_USD);
  });
});

describe("CostAccumulator", () => {
  it("accumulates a running per-site total", () => {
    const acc = new CostAccumulator();
    acc.record(GEMINI_MODELS.pro, { inputTokens: 30_000, outputTokens: 12_000 });
    acc.record(GEMINI_MODELS.flash, { inputTokens: 5_000, outputTokens: 1_000 });
    const snap = acc.snapshot();
    expect(snap.callCount).toBe(2);
    expect(snap.totalInputTokens).toBe(35_000);
    expect(snap.totalOutputTokens).toBe(13_000);
    expect(snap.totalUsd).toBeGreaterThan(0);
    expect(snap.remainingUsd).toBeCloseTo(snap.capUsd - snap.totalUsd, 6);
  });

  it("flags and blocks spend that would exceed the $2 cap", () => {
    const acc = new CostAccumulator(0.5);
    expect(acc.wouldExceed(0.6)).toBe(true);
    expect(() => acc.assertCanSpend(0.6)).toThrow(CostBudgetExceededError);
  });

  it("enforces the 3-images-per-site cap (§6.7, §8.4)", () => {
    const acc = new CostAccumulator();
    for (let i = 0; i < 3; i++) {
      acc.assertCanGenerateImage();
      acc.record(
        GEMINI_MODELS.flashImage,
        { inputTokens: 100, outputTokens: 1290 },
        true,
      );
    }
    expect(acc.snapshot().imageCount).toBe(3);
    expect(() => acc.assertCanGenerateImage()).toThrow(CostBudgetExceededError);
  });
});
