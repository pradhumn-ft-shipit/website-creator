import { describe, expect, it } from "vitest";

import {
  assertWithinInputCap,
  assertWithinOutputCap,
  getBudget,
  TOKEN_BUDGETS,
} from "./budgets";
import { TokenBudgetExceededError } from "./errors";

describe("token budgets (§8.4)", () => {
  it("matches the PRD §8.4 hard caps for full-site generation", () => {
    expect(getBudget("full_site_generation")).toMatchObject({
      targetInput: 30_000,
      targetOutput: 12_000,
      capInput: 50_000,
      capOutput: 20_000,
    });
  });

  it("matches the PRD §8.4 caps for Layer-2 and edit", () => {
    expect(TOKEN_BUDGETS.compliance_layer2.capInput).toBe(10_000);
    expect(TOKEN_BUDGETS.compliance_layer2.capOutput).toBe(2_000);
    expect(TOKEN_BUDGETS.post_launch_edit.capInput).toBe(3_000);
    expect(TOKEN_BUDGETS.post_launch_edit.capOutput).toBe(1_500);
  });

  it("allows input at exactly the cap", () => {
    expect(() => assertWithinInputCap("full_site_generation", 50_000)).not.toThrow();
  });

  it("throws a typed error when input exceeds the cap (no silent truncation)", () => {
    expect(() => assertWithinInputCap("full_site_generation", 50_001)).toThrow(
      TokenBudgetExceededError,
    );
    try {
      assertWithinInputCap("compliance_layer2", 10_001);
    } catch (e) {
      const err = e as TokenBudgetExceededError;
      expect(err.kind).toBe("input");
      expect(err.cap).toBe(10_000);
      expect(err.tokens).toBe(10_001);
      expect(err.code).toBe("token_budget_exceeded");
      expect(err.retryable).toBe(false);
    }
  });

  it("throws a typed error when output exceeds the cap", () => {
    expect(() => assertWithinOutputCap("post_launch_edit", 1_501)).toThrow(
      TokenBudgetExceededError,
    );
  });
});
