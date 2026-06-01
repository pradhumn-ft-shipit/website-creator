/**
 * Rate-limit error contract — the seam to reconcile with ticket 008 (Gemini
 * client) and any other external client (Firecrawl, Vercel, GitHub, Resend,
 * IAPD).
 *
 * SEAM NOTE (008): 009 does NOT import from 008's tree. Instead we define the
 * shape a rate-limit error must satisfy. 008 should either throw `RateLimitError`
 * from here, or throw an error carrying `{ isRateLimit: true, retryAfterMs? }`.
 * `isRateLimitError` recognises both: the `instanceof` form and the duck-typed
 * marker form. When 008 lands, point its client at this module (or keep its own
 * error and ensure it carries the marker) — no other change needed.
 */

export interface RateLimitErrorShape {
  /** Discriminator the pipeline checks to trigger Inngest backoff + retry. */
  isRateLimit: true;
  /** Optional hint from the upstream API (e.g. Retry-After header), in ms. */
  retryAfterMs?: number;
  /** Service that rate-limited us, for the state/rate-limits.md log entry. */
  service?: string;
  /** Endpoint that rate-limited us, for the log entry. */
  endpoint?: string;
}

export class RateLimitError extends Error implements RateLimitErrorShape {
  readonly isRateLimit = true as const;
  readonly retryAfterMs?: number;
  readonly service?: string;
  readonly endpoint?: string;

  constructor(
    message: string,
    opts: { retryAfterMs?: number; service?: string; endpoint?: string } = {},
  ) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfterMs = opts.retryAfterMs;
    this.service = opts.service;
    this.endpoint = opts.endpoint;
  }
}

/**
 * Type guard recognising both the class form and the duck-typed marker form,
 * so any 008-style client interoperates without importing this class.
 */
export function isRateLimitError(err: unknown): err is RateLimitErrorShape {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { isRateLimit?: unknown }).isRateLimit === true
  );
}
