/**
 * Typed Resend errors. Mirrors the Gemini/Firecrawl error posture (008/012):
 * a rate limit is retryable and carries the duck-typed `isRateLimit` marker so
 * `lib/inngest/errors.ts#isRateLimitError` (009) recognises it WITHOUT importing
 * this tree; anything else is a hard send failure the caller surfaces, never
 * silently swallowed.
 *
 * Distinct from the CLAUDE.md "bounce/complaint" fallback, which is a POST-send
 * outcome (delivery failed after Resend accepted the send) handled by the
 * webhook (`webhook.ts`), not a send-time error.
 */

export class EmailRateLimitError extends Error {
  /** 009 seam: duck-typed marker `isRateLimitError()` recognises. */
  readonly isRateLimit = true as const;
  readonly service = "resend" as const;
  readonly endpoint: string;
  readonly retryAfterMs?: number;

  constructor(endpoint: string, opts: { retryAfterMs?: number; cause?: unknown } = {}) {
    super("Resend is rate-limited; backing off and retrying.");
    this.name = "EmailRateLimitError";
    this.endpoint = endpoint;
    this.retryAfterMs = opts.retryAfterMs;
    if (opts.cause !== undefined) this.cause = opts.cause;
  }
}

/** A non-rate-limit send failure (auth, validation, 5xx, malformed response). */
export class EmailSendError extends Error {
  readonly code: string;

  constructor(message: string, code = "email_send_failed", opts: { cause?: unknown } = {}) {
    super(message);
    this.name = "EmailSendError";
    this.code = code;
    if (opts.cause !== undefined) this.cause = opts.cause;
  }
}
