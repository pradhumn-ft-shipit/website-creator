/**
 * GeminiClient — the one place every AI call goes through (PRD §8). Callers pass
 * an *intent* (use case + operation) + a schema + a prompt; the client picks the
 * model (§8.1), enforces token budgets (§8.4, fail-loud per §8.2.7), coerces the
 * output to schema-valid JSON with one repair pass (§8.2.3 — never free text),
 * accounts cost, and maps rate limits to a typed retryable error for 009.
 *
 * Testability follows the auth-service pattern: the SDK is injected as a small
 * structural boundary (`GenAIBoundary`), so unit tests pass a stub and there is
 * no live call. `geminiClient()` wires the real `@google/genai` SDK from env.
 */

import { GoogleGenAI } from "@google/genai";

import {
  assertWithinInputCap,
  assertWithinOutputCap,
  type GeminiOperation,
} from "./budgets";
import { CostAccumulator, type TokenUsage } from "./cost";
import {
  GeminiRateLimitError,
  SchemaValidationError,
} from "./errors";
import {
  estimateTokens,
} from "./tokens";
import {
  resolveModel,
  type GeminiModelId,
  type GeminiUseCase,
} from "./models";

/**
 * Minimal structural slice of the `@google/genai` SDK this client depends on.
 * The real `GoogleGenAI` instance satisfies this; tests inject a stub.
 */
export interface GenAIBoundary {
  models: {
    generateContent(params: {
      model: string;
      contents: unknown;
      config?: Record<string, unknown>;
    }): Promise<GenAIResponse>;
  };
}

export interface GenAIResponse {
  text?: string;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

/**
 * A schema the client can validate model output against. Bring your own
 * (hand-written, Zod's `.parse`, etc.) — `jsonSchema` is forwarded to Gemini's
 * structured-output config; `parse` is the authoritative gate that throws on a
 * mismatch. Generic over the parsed type.
 */
export interface OutputSchema<T> {
  /** JSON Schema sent to Gemini as `responseJsonSchema` to steer the model. */
  jsonSchema: unknown;
  /** Throw if `value` does not conform; otherwise return the typed value. */
  parse(value: unknown): T;
}

export interface GenerateJSONOptions<T> {
  useCase: GeminiUseCase;
  operation: GeminiOperation;
  schema: OutputSchema<T>;
  prompt: string;
  /** Compliance rulebook etc. lives here, NOT in the prompt (§8.2.2). */
  systemInstruction?: string;
  /** Override the default single repair attempt (§8.2.3). */
  maxRepairAttempts?: number;
}

export interface GenerateJSONResult<T> {
  data: T;
  model: GeminiModelId;
  /** Summed across the initial call and any repair attempts. */
  usage: TokenUsage;
  /** Estimated USD cost for this whole operation (all attempts). */
  costUsd: number;
}

export interface GeminiClientOptions {
  /** Per-site cost guard; pass one per order to enforce the <$2 cap. */
  costAccumulator?: CostAccumulator;
}

function readUsage(res: GenAIResponse): TokenUsage {
  return {
    inputTokens: res.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: res.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

/** Pull a JSON object/array out of model text, tolerating ``` fences + prose. */
function extractJson(text: string): unknown {
  const trimmed = text.trim();
  // Strip a ```json … ``` (or bare ```) fence if present.
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fence ? fence[1] : trimmed).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    // Last resort: grab the outermost {...} or [...] span.
    const start = candidate.search(/[[{]/);
    const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
    if (start !== -1 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new SchemaValidationError("output was not parseable JSON");
  }
}

/** Detect Gemini rate-limit / overload responses across SDK + raw error shapes. */
function isRateLimit(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status === 429 || status === 503) return true;
  const msg = String((err as { message?: string })?.message ?? "").toLowerCase();
  return (
    msg.includes("resource_exhausted") ||
    msg.includes("resource exhausted") ||
    msg.includes("rate limit") ||
    msg.includes("quota") ||
    msg.includes("overloaded")
  );
}

export class GeminiClient {
  constructor(
    private readonly sdk: GenAIBoundary,
    private readonly options: GeminiClientOptions = {},
  ) {}

  async generateJSON<T>(
    opts: GenerateJSONOptions<T>,
  ): Promise<GenerateJSONResult<T>> {
    const { model, useSearch } = resolveModel(opts.useCase);
    const isImage = opts.useCase === "image";

    // Pre-flight input cap (§8.2.7): count the prompt before we spend anything.
    const inputEstimate = estimateTokens(
      `${opts.systemInstruction ?? ""}\n${opts.prompt}`,
    );
    assertWithinInputCap(opts.operation, inputEstimate);

    const maxRepairs = opts.maxRepairAttempts ?? 1;
    let totalIn = 0;
    let totalOut = 0;
    let lastIssue = "no response";
    let prompt = opts.prompt;

    for (let attempt = 0; attempt <= maxRepairs; attempt++) {
      const res = await this.dispatch({
        model,
        prompt,
        systemInstruction: opts.systemInstruction,
        jsonSchema: opts.schema.jsonSchema,
        useSearch,
      });

      const usage = readUsage(res);
      totalIn += usage.inputTokens;
      totalOut += usage.outputTokens;

      // Output cap is about tokens, not shape — judge it on this response BEFORE
      // parsing, and fail loud (§8.2.7). Re-prompting can't shrink an over-cap
      // generation, so this throws straight out of the loop.
      assertWithinOutputCap(opts.operation, usage.outputTokens);

      const text = res.text ?? "";
      try {
        const parsed = opts.schema.parse(extractJson(text));
        const aggregate: TokenUsage = {
          inputTokens: totalIn,
          outputTokens: totalOut,
        };
        const costUsd = this.options.costAccumulator
          ? this.options.costAccumulator.record(model, aggregate, isImage)
          : this.estimate(model, aggregate);
        return { data: parsed, model, usage: aggregate, costUsd };
      } catch (err) {
        // Parse/validation failures (plain Error or SchemaValidationError) are
        // repairable; everything else above already threw out of the loop.
        lastIssue = (err as Error)?.message ?? "schema mismatch";
        // Build a repair prompt that shows the model its own bad output.
        prompt =
          `${opts.prompt}\n\nYour previous response was not valid JSON ` +
          `matching the required schema (error: ${lastIssue}). ` +
          `Respond ONLY with the corrected JSON, no prose, no code fences.`;
      }
    }

    throw new SchemaValidationError(lastIssue);
  }

  private estimate(model: GeminiModelId, usage: TokenUsage): number {
    // Local estimate when no accumulator is tracking the site.
    return new CostAccumulator(Number.POSITIVE_INFINITY).record(model, usage);
  }

  private async dispatch(args: {
    model: GeminiModelId;
    prompt: string;
    systemInstruction?: string;
    jsonSchema: unknown;
    useSearch: boolean;
  }): Promise<GenAIResponse> {
    const config: Record<string, unknown> = {
      responseMimeType: "application/json",
      responseJsonSchema: args.jsonSchema,
    };
    if (args.systemInstruction) {
      config.systemInstruction = args.systemInstruction;
    }
    if (args.useSearch) {
      config.tools = [{ googleSearch: {} }];
      // Search grounding is incompatible with forced JSON mime; drop it and
      // rely on schema parse + repair for the research agent.
      delete config.responseMimeType;
    }
    try {
      return await this.sdk.models.generateContent({
        model: args.model,
        contents: args.prompt,
        config,
      });
    } catch (err) {
      if (isRateLimit(err)) {
        throw new GeminiRateLimitError(args.model, { cause: err });
      }
      throw err;
    }
  }
}

let singleton: GeminiClient | undefined;

/**
 * The real, env-wired client. Reads `GEMINI_API_KEY` (dev key per §9.3 — low
 * quotas). Throws if the key is missing so misconfiguration fails fast rather
 * than at the first live call. Lazily memoized.
 */
export function geminiClient(options?: GeminiClientOptions): GeminiClient {
  if (options?.costAccumulator) {
    // A per-site accumulator means a per-site client; never share the singleton.
    return new GeminiClient(realBoundary(), options);
  }
  if (!singleton) singleton = new GeminiClient(realBoundary());
  return singleton;
}

function realBoundary(): GenAIBoundary {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add a dev key (low quotas, §9.3) to .env.local.",
    );
  }
  // GoogleGenAI's `.models.generateContent` satisfies GenAIBoundary structurally.
  return new GoogleGenAI({ apiKey }) as unknown as GenAIBoundary;
}
