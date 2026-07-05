/**
 * Public surface of the Gemini module — the only entry point callers (and
 * ticket 009's Inngest steps) should import from. SDK details stay internal.
 */

export {
  GeminiClient,
  geminiClient,
  type GenAIBoundary,
  type GenAIResponse,
  type GeminiFilePart,
  type OutputSchema,
  type GenerateJSONOptions,
  type GenerateJSONResult,
  type GenerateImageOptions,
  type GenerateImageResult,
  type GeminiClientOptions,
} from "./client";

export {
  resolveModel,
  GEMINI_MODELS,
  PRICING,
  type GeminiUseCase,
  type GeminiModelId,
  type ResolvedModel,
  type ModelPricing,
} from "./models";

export {
  TOKEN_BUDGETS,
  MAX_IMAGES_PER_SITE,
  getBudget,
  assertWithinInputCap,
  assertWithinOutputCap,
  type GeminiOperation,
  type TokenBudget,
} from "./budgets";

export {
  CostAccumulator,
  estimateCostUsd,
  PER_SITE_COST_CAP_USD,
  type TokenUsage,
  type CostSnapshot,
  type CostRecord,
} from "./cost";

export {
  GeminiRateLimitError,
  TokenBudgetExceededError,
  SchemaValidationError,
  CostBudgetExceededError,
} from "./errors";

export { estimateTokens } from "./tokens";
