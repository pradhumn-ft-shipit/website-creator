/**
 * Typed Firecrawl errors. Mirrors the Gemini error posture (008): the one mode
 * the pipeline (009) must branch on — a rate limit — carries the duck-typed
 * `isRateLimit` marker so `lib/inngest/errors.ts#isRateLimitError` recognises it
 * WITHOUT importing from this tree, and the `service`/`endpoint` fields the
 * `state/rate-limits.md` logger reads.
 *
 * CLAUDE.md fallback contract: a Firecrawl rate limit (or insufficient content)
 * falls through to the docs-upload path. The rate-limit case is transient, so we
 * surface it as retryable here and let Inngest back off; the insufficient-content
 * case is handled by the sufficiency check, not by an error.
 */

export class FirecrawlRateLimitError extends Error {
  /** 009 seam: duck-typed marker `isRateLimitError()` recognises. */
  readonly isRateLimit = true as const;
  readonly service = "firecrawl" as const;
  readonly endpoint: string;
  readonly retryAfterMs?: number;

  constructor(
    endpoint: string,
    opts: { retryAfterMs?: number; cause?: unknown } = {},
  ) {
    super("Firecrawl is rate-limited; backing off and retrying.");
    this.name = "FirecrawlRateLimitError";
    this.endpoint = endpoint;
    this.retryAfterMs = opts.retryAfterMs;
    if (opts.cause !== undefined) this.cause = opts.cause;
  }
}

/**
 * A non-rate-limit Firecrawl failure (auth, 5xx, malformed response, crawl job
 * reported `failed`). NOT marked retryable here — the pipeline's scrape step
 * treats a hard scrape failure as a route into the docs-upload fallback (§4.3),
 * not as an Inngest retry.
 */
export class FirecrawlError extends Error {
  readonly endpoint: string;
  readonly status?: number;

  constructor(message: string, endpoint: string, opts: { status?: number; cause?: unknown } = {}) {
    super(message);
    this.name = "FirecrawlError";
    this.endpoint = endpoint;
    this.status = opts.status;
    if (opts.cause !== undefined) this.cause = opts.cause;
  }
}
