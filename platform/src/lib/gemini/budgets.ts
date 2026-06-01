/**
 * Token budgets (PRD §8.4). Each operation has a soft target (for cost planning)
 * and a hard cap. Exceeding a hard cap fails loudly (PRD §8.2.7) — the client
 * never silently truncates. Budgets are keyed by operation, decoupled from model
 * routing so the same model can run different-budget operations.
 */

import { TokenBudgetExceededError } from "./errors";

export type GeminiOperation =
  | "full_site_generation"
  | "compliance_layer2"
  | "post_launch_edit"
  | "image_generation";

export interface TokenBudget {
  /** Soft planning targets (not enforced; used for telemetry/headroom checks). */
  targetInput: number;
  targetOutput: number;
  /** Hard caps — exceeding either throws TokenBudgetExceededError. */
  capInput: number;
  capOutput: number;
}

/** §8.4 table, verbatim. Image budget caps the *call count*, handled separately. */
export const TOKEN_BUDGETS: Record<GeminiOperation, TokenBudget> = {
  full_site_generation: {
    targetInput: 30_000,
    targetOutput: 12_000,
    capInput: 50_000,
    capOutput: 20_000,
  },
  compliance_layer2: {
    targetInput: 5_000,
    targetOutput: 1_000,
    capInput: 10_000,
    capOutput: 2_000,
  },
  post_launch_edit: {
    targetInput: 1_000,
    targetOutput: 500,
    capInput: 3_000,
    capOutput: 1_500,
  },
  // §8.4: "1 image" target, "3 per site total" cap — a count, not a token budget.
  // We give image calls Flash-level token caps for the text prompt; the 3-per-site
  // cap is enforced by the cost accumulator's image counter.
  image_generation: {
    targetInput: 1_000,
    targetOutput: 1_500,
    capInput: 3_000,
    capOutput: 2_000,
  },
};

/** Max AI-generated images per site (PRD §6.7, §8.4). */
export const MAX_IMAGES_PER_SITE = 3;

export function getBudget(operation: GeminiOperation): TokenBudget {
  const budget = TOKEN_BUDGETS[operation];
  if (!budget) throw new Error(`Unknown Gemini operation: ${String(operation)}`);
  return budget;
}

/**
 * Throw if `inputTokens` exceeds the operation's hard input cap. Called BEFORE
 * dispatching the request (we count the prompt up front) so we never pay for a
 * call we already know is over budget.
 */
export function assertWithinInputCap(
  operation: GeminiOperation,
  inputTokens: number,
): void {
  const { capInput } = getBudget(operation);
  if (inputTokens > capInput) {
    throw new TokenBudgetExceededError({
      operation,
      kind: "input",
      tokens: inputTokens,
      cap: capInput,
    });
  }
}

/**
 * Throw if `outputTokens` exceeds the operation's hard output cap. Called AFTER
 * the response returns (output size is only known then) — fail loud rather than
 * accept an over-budget generation downstream.
 */
export function assertWithinOutputCap(
  operation: GeminiOperation,
  outputTokens: number,
): void {
  const { capOutput } = getBudget(operation);
  if (outputTokens > capOutput) {
    throw new TokenBudgetExceededError({
      operation,
      kind: "output",
      tokens: outputTokens,
      cap: capOutput,
    });
  }
}
