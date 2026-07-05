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
  | "image_generation"
  | "intake_extraction"
  | "compliance_research";

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
  // NOT in the §8.4 table — added by ticket 012 for the intake.process step.
  // Input is the concatenated scrape markdown + uploaded-doc text, which for a
  // real multi-page site is large; the structured Round-1 output (§8.3, ~a dozen
  // fields with confidence + sources) is small. Runs on Flash (cheap), so we use
  // a deliberately generous input cap rather than fail real sites at the loud cap.
  // Note: PDF inline parts add input tokens the pre-flight text estimate cannot
  // see — the cost accumulator records the true count post-call. Tune in alpha.
  intake_extraction: {
    targetInput: 30_000,
    targetOutput: 3_000,
    capInput: 120_000,
    capOutput: 8_000,
  },
  // NOT in the §8.4 table — added by ticket 035 for the /admin/compliance
  // research agent (Gemini 2.5 Pro + Google Search). Input is the current
  // ruleset markdown + the scan prompt (a few thousand tokens); the structured,
  // cited diff proposal output is moderate. Search grounding can enlarge output,
  // so we give it generous caps. This is an internal, low-volume admin call — not
  // on the per-site generation budget — so it never affects the <$2/site guard.
  compliance_research: {
    targetInput: 10_000,
    targetOutput: 4_000,
    capInput: 20_000,
    capOutput: 8_000,
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
