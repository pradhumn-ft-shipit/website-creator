/**
 * Cost accounting + the per-site cost guard (CLAUDE.md: keep per-site
 * generation under $2). Every call returns its token usage; `estimateCostUsd`
 * turns usage into dollars from the §8.1 pricing table, and `CostAccumulator`
 * tracks the running per-site total so the pipeline can stop before $2.
 */

import { CostBudgetExceededError } from "./errors";
import { MAX_IMAGES_PER_SITE } from "./budgets";
import { PRICING, type GeminiModelId } from "./models";

/** Token usage for a single call, as reported by the SDK's usageMetadata. */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

/** Per-site spend cap (CLAUDE.md cost guardrail). */
export const PER_SITE_COST_CAP_USD = 2.0;

/** Estimated USD cost of one call's usage on a given model. */
export function estimateCostUsd(
  model: GeminiModelId,
  usage: TokenUsage,
): number {
  const pricing = PRICING[model];
  if (!pricing) throw new Error(`No pricing for model: ${model}`);
  const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPerMillion;
  return inputCost + outputCost;
}

export interface CostRecord {
  model: GeminiModelId;
  usage: TokenUsage;
  costUsd: number;
}

/** Snapshot of accumulated per-site spend. */
export interface CostSnapshot {
  totalUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  imageCount: number;
  callCount: number;
  capUsd: number;
  remainingUsd: number;
}

/**
 * Accumulates Gemini spend for ONE site's pipeline run. Construct one per order,
 * record each call, and check `assertCanSpend` before an expensive call to stop
 * before the $2 cap. Also enforces the 3-images-per-site cap (§6.7, §8.4).
 */
export class CostAccumulator {
  private totalUsd = 0;
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private imageCount = 0;
  private callCount = 0;

  constructor(private readonly capUsd: number = PER_SITE_COST_CAP_USD) {}

  /**
   * Record one dispatched call's token spend; returns its cost. Call this for
   * EVERY attempt that hit the wire — including a failed parse, a repair, or an
   * over-cap response — because those tokens were still billed. Recording only
   * the successful attempt undercounts spend and lets a site slip past the $2
   * guard (the failure/repair loop is exactly where spend balloons).
   */
  recordUsage(model: GeminiModelId, usage: TokenUsage): number {
    const cost = estimateCostUsd(model, usage);
    this.totalUsd += cost;
    this.totalInputTokens += usage.inputTokens;
    this.totalOutputTokens += usage.outputTokens;
    this.callCount += 1;
    return cost;
  }

  /**
   * Consume one unit of the per-site image quota (§6.7, §8.4). Call this ONLY
   * after an image generation *succeeds* — a failed image attempt still costs
   * tokens (record those via `recordUsage`) but must not burn the 3-image quota.
   */
  recordImage(): void {
    this.imageCount += 1;
  }

  /**
   * Record a completed call's token spend and, when it was a *successful* image,
   * its image-quota use. Convenience for callers that account for everything at
   * once on the success path. Returns the call's cost.
   */
  record(model: GeminiModelId, usage: TokenUsage, isImage = false): number {
    const cost = this.recordUsage(model, usage);
    if (isImage) this.recordImage();
    return cost;
  }

  /** Would adding `additionalUsd` push past the per-site cap? */
  wouldExceed(additionalUsd: number): boolean {
    return this.totalUsd + additionalUsd > this.capUsd;
  }

  /**
   * Throw if accepting `additionalUsd` would breach the cap. Call this with a
   * conservative pre-estimate before a costly generation so the pipeline halts
   * cleanly instead of overspending.
   */
  assertCanSpend(additionalUsd: number): void {
    if (this.wouldExceed(additionalUsd)) {
      throw new CostBudgetExceededError({
        spentUsd: this.totalUsd + additionalUsd,
        capUsd: this.capUsd,
      });
    }
  }

  /** Throw if the site has already used its image quota (§6.7, §8.4). */
  assertCanGenerateImage(): void {
    if (this.imageCount >= MAX_IMAGES_PER_SITE) {
      throw new CostBudgetExceededError({
        spentUsd: this.totalUsd,
        capUsd: this.capUsd,
      });
    }
  }

  snapshot(): CostSnapshot {
    return {
      totalUsd: this.totalUsd,
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      imageCount: this.imageCount,
      callCount: this.callCount,
      capUsd: this.capUsd,
      remainingUsd: Math.max(0, this.capUsd - this.totalUsd),
    };
  }
}
