/**
 * Typed SEC IAPD errors. Mirrors the Firecrawl/Gemini error posture (008/012):
 * the one mode the pipeline (009) must branch on — a rate limit — carries the
 * duck-typed `isRateLimit` marker so `lib/inngest/errors.ts#isRateLimitError`
 * recognises it WITHOUT importing from this tree, and the `service`/`endpoint`
 * fields the `state/rate-limits.md` logger reads.
 *
 * CLAUDE.md fallback contract: "SEC IAPD unavailable: fall back to scrape,
 * then to direct upload (PRD §5.4)." A rate limit is transient — surfaced here
 * as retryable so Inngest backs off. A hard failure (CRD not found, malformed
 * response, 5xx, or a document download failure) is NOT retryable — the iapd
 * step catches it and walks the fallback chain instead.
 */

export class IapdRateLimitError extends Error {
  /** 009 seam: duck-typed marker `isRateLimitError()` recognises. */
  readonly isRateLimit = true as const;
  readonly service = "iapd" as const;
  readonly endpoint: string;
  readonly retryAfterMs?: number;

  constructor(endpoint: string, opts: { retryAfterMs?: number; cause?: unknown } = {}) {
    super("SEC IAPD is rate-limited; backing off and retrying.");
    this.name = "IapdRateLimitError";
    this.endpoint = endpoint;
    this.retryAfterMs = opts.retryAfterMs;
    if (opts.cause !== undefined) this.cause = opts.cause;
  }
}

/**
 * A non-rate-limit IAPD failure (CRD not found, auth/5xx, malformed response,
 * or a document download failure). NOT retryable here — the iapd step treats a
 * hard failure as a route into the §5.4 fallback chain (scrape → upload
 * prompt), not as an Inngest retry.
 */
export class IapdError extends Error {
  readonly endpoint: string;
  readonly status?: number;

  constructor(message: string, endpoint: string, opts: { status?: number; cause?: unknown } = {}) {
    super(message);
    this.name = "IapdError";
    this.endpoint = endpoint;
    this.status = opts.status;
    if (opts.cause !== undefined) this.cause = opts.cause;
  }
}
