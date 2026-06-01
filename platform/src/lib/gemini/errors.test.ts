import { describe, expect, it } from "vitest";

import { GeminiRateLimitError } from "./errors";

/**
 * Locks the 009 seam: 009 detects rate-limits by the duck-typed `isRateLimit`
 * marker and logs `service`/`endpoint` to state/rate-limits.md — all WITHOUT
 * importing from this tree. If any of these fields drift, 009's retry path goes
 * blind, so they are pinned here. The end-to-end "009 actually catches this"
 * proof lives in the inngest seam test (it imports both sides).
 */
describe("GeminiRateLimitError — 009 seam contract", () => {
  it("carries the marker + log fields 009's duck-typed guard reads", () => {
    const err = new GeminiRateLimitError("gemini-2.5-pro", {
      retryAfterMs: 1200,
    });

    expect(err.isRateLimit).toBe(true);
    expect(err.retryable).toBe(true);
    expect(err.service).toBe("gemini");
    expect(err.endpoint).toBe("gemini-2.5-pro");
    expect(err.model).toBe("gemini-2.5-pro");
    expect(err.code).toBe("gemini_rate_limited");
    expect(err.status).toBe(429);
    expect(err.retryAfterMs).toBe(1200);
  });
});
