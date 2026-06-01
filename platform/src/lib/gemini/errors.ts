/**
 * Typed Gemini errors. Every failure mode of the client surfaces as one of these
 * so callers can branch on *kind*, not on a parsed string.
 *
 * These extend `AppError` so that when a Gemini failure reaches a route handler
 * it flows through `apiHandler` into the `{data,error}` envelope with a sensible
 * code/status — no hand-built envelope, no leaked raw SDK message.
 */

import { AppError } from "@/lib/api/envelope";

/**
 * The cross-ticket seam with 009 (Inngest + state machine).
 *
 * Thrown when Gemini returns a rate-limit / quota / overload response (HTTP 429,
 * or 503 RESOURCE_EXHAUSTED). 009's Inngest layer catches THIS class to:
 *   1. back off + retry with exponential backoff, and
 *   2. log to `state/rate-limits.md` (service=gemini, endpoint=<model>, code).
 *
 * Contract (stable — 009 depends on this shape):
 *   - `instanceof GeminiRateLimitError` is the catch predicate.
 *   - `name === "GeminiRateLimitError"`.
 *   - `code === "gemini_rate_limited"` (also the envelope error code).
 *   - `retryable === true` (always; this is the definition of the class).
 *   - `status === 429` (envelope HTTP status).
 *   - `model: string` — the model id that was rate-limited (for the log line).
 *   - `retryAfterMs?: number` — server-suggested backoff if Gemini provided one
 *     (from Retry-After / RetryInfo); undefined means "use your own backoff".
 *
 * 009 reconciliation: 009's `isRateLimitError()` guard is duck-typed on
 * `isRateLimit === true`, and its `state/rate-limits.md` logger reads
 * `service`/`endpoint`. We carry all three so 009 recognises and logs this
 * error WITHOUT importing from the gemini tree:
 *   - `isRateLimit === true` — the marker 009's guard checks.
 *   - `service === "gemini"` — the log-line service column.
 *   - `endpoint: string` — the rate-limited model id (mirrors `model`).
 */
export class GeminiRateLimitError extends AppError {
  readonly retryable = true as const;
  /** 009 seam: duck-typed marker `isRateLimitError()` recognises. */
  readonly isRateLimit = true as const;
  /** 009 seam: `service` column for the state/rate-limits.md log line. */
  readonly service = "gemini" as const;
  readonly model: string;
  /** 009 seam: `endpoint` column — the rate-limited model id. */
  readonly endpoint: string;
  readonly retryAfterMs?: number;

  constructor(model: string, opts?: { retryAfterMs?: number; cause?: unknown }) {
    super(
      "The AI service is busy. We'll keep trying automatically.",
      "gemini_rate_limited",
      429,
    );
    this.name = "GeminiRateLimitError";
    this.model = model;
    this.endpoint = model;
    this.retryAfterMs = opts?.retryAfterMs;
    if (opts?.cause !== undefined) this.cause = opts.cause;
  }
}

/**
 * Thrown when a call's input or output token count exceeds the §8.4 hard cap.
 * We fail loudly here (PRD §8.2.7) — never silently truncate. NOT retryable:
 * retrying the same oversized request just burns money for the same failure.
 */
export class TokenBudgetExceededError extends AppError {
  readonly retryable = false as const;
  readonly operation: string;
  readonly kind: "input" | "output";
  readonly tokens: number;
  readonly cap: number;

  constructor(args: {
    operation: string;
    kind: "input" | "output";
    tokens: number;
    cap: number;
  }) {
    super(
      `Token budget exceeded for "${args.operation}": ${args.kind} ${args.tokens} > cap ${args.cap}.`,
      "token_budget_exceeded",
      422,
    );
    this.name = "TokenBudgetExceededError";
    this.operation = args.operation;
    this.kind = args.kind;
    this.tokens = args.tokens;
    this.cap = args.cap;
  }
}

/**
 * Thrown when the model's output cannot be coerced into the requested schema,
 * even after the one repair attempt (§8.2.3). No free-text fallthrough — callers
 * always get a typed object or this error. NOT retryable at the SDK layer (the
 * repair pass already retried); a higher layer may choose to re-prompt.
 */
export class SchemaValidationError extends AppError {
  readonly retryable = false as const;
  readonly issues: string[];

  constructor(message: string, issues: string[] = []) {
    super(
      `Model output did not match the expected schema: ${message}`,
      "gemini_schema_invalid",
      502,
    );
    this.name = "SchemaValidationError";
    this.issues = issues;
  }
}

/**
 * Thrown when the per-site cost guard would be breached by accepting a call's
 * cost (CLAUDE.md: keep per-site generation under $2). Lets the pipeline stop
 * before spending past the budget rather than discovering it after the fact.
 */
export class CostBudgetExceededError extends AppError {
  readonly retryable = false as const;
  readonly spentUsd: number;
  readonly capUsd: number;

  constructor(args: { spentUsd: number; capUsd: number }) {
    super(
      `Per-site cost cap reached: $${args.spentUsd.toFixed(4)} would exceed $${args.capUsd.toFixed(2)}.`,
      "gemini_cost_exceeded",
      402,
    );
    this.name = "CostBudgetExceededError";
    this.spentUsd = args.spentUsd;
    this.capUsd = args.capUsd;
  }
}
