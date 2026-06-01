/**
 * Model routing + pricing — the single source of truth for which Gemini model
 * each use case maps to (PRD §8.1) and what a token costs. Callers pass an
 * *intent* (use case); they never name a model or a price. This is the only
 * place model ids and pricing constants live.
 */

/**
 * Use cases, mapped 1:1 to PRD §8.1 rows:
 *   generation → initial copy generation (Gemini 2.5 Pro)
 *   validation → compliance Layer 2 validation (Gemini 2.5 Flash)
 *   edit       → post-launch edit chat (Gemini 2.5 Flash)
 *   image      → image generation, capped (Gemini 2.5 Flash Image / Nano Banana)
 *   research   → compliance research agent, admin tool (Gemini 2.5 Pro + web search)
 */
export type GeminiUseCase =
  | "generation"
  | "validation"
  | "edit"
  | "image"
  | "research";

/** Pinned model ids. Keep in lockstep with PRD §8.1; bump deliberately. */
export const GEMINI_MODELS = {
  pro: "gemini-2.5-pro",
  flash: "gemini-2.5-flash",
  flashImage: "gemini-2.5-flash-image",
} as const;

export type GeminiModelId = (typeof GEMINI_MODELS)[keyof typeof GEMINI_MODELS];

/** Whether a use case enables the Google Search grounding tool (§8.1 research row). */
const SEARCH_USE_CASES: ReadonlySet<GeminiUseCase> = new Set(["research"]);

const MODEL_BY_USE_CASE: Record<GeminiUseCase, GeminiModelId> = {
  generation: GEMINI_MODELS.pro,
  validation: GEMINI_MODELS.flash,
  edit: GEMINI_MODELS.flash,
  image: GEMINI_MODELS.flashImage,
  research: GEMINI_MODELS.pro,
};

export interface ResolvedModel {
  useCase: GeminiUseCase;
  model: GeminiModelId;
  /** True when the call should attach the Google Search grounding tool. */
  useSearch: boolean;
}

/** Route a use case to its model + tool config (§8.1). */
export function resolveModel(useCase: GeminiUseCase): ResolvedModel {
  const model = MODEL_BY_USE_CASE[useCase];
  if (!model) {
    throw new Error(`Unknown Gemini use case: ${String(useCase)}`);
  }
  return { useCase, model, useSearch: SEARCH_USE_CASES.has(useCase) };
}

/**
 * Token pricing in USD per 1,000,000 tokens.
 *
 * Source: Google "Gemini API pricing" (ai.google.dev/gemini-api/docs/pricing),
 * standard paid tier, captured 2026-05. Gemini 2.5 Pro is tiered by prompt size
 * (the higher tier applies above 200k input tokens); WRI's full-site budget is
 * 50k input hard-cap (§8.4), so we always sit in the <=200k tier — we encode the
 * low tier and document the high tier for traceability. Flash is flat-rate.
 *
 * If pricing changes, update HERE and only here, then re-run the cost tests.
 */
export interface ModelPricing {
  /** USD per 1M input (prompt) tokens. */
  inputPerMillion: number;
  /** USD per 1M output (completion) tokens. */
  outputPerMillion: number;
}

export const PRICING: Record<GeminiModelId, ModelPricing> = {
  // Gemini 2.5 Pro — <=200k prompt tier ($1.25 in / $10.00 out).
  // (>200k tier is $2.50 in / $15.00 out; never reached within §8.4 caps.)
  "gemini-2.5-pro": { inputPerMillion: 1.25, outputPerMillion: 10.0 },
  // Gemini 2.5 Flash — $0.30 in / $2.50 out.
  "gemini-2.5-flash": { inputPerMillion: 0.3, outputPerMillion: 2.5 },
  // Gemini 2.5 Flash Image — text in priced as Flash; image output billed per
  // image (≈1290 output tokens/image at $30/1M ≈ $0.039/image). We model the
  // output-token rate so cost falls out of usage like every other call.
  "gemini-2.5-flash-image": { inputPerMillion: 0.3, outputPerMillion: 30.0 },
};
