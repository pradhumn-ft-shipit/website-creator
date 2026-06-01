import { describe, it, expect } from "vitest";

import { GeminiRateLimitError } from "@/lib/gemini";
import { RateLimitError, isRateLimitError } from "./errors";

describe("RateLimitError", () => {
  it("carries the marker and optional fields", () => {
    const err = new RateLimitError("slow down", {
      retryAfterMs: 2000,
      service: "gemini",
      endpoint: "generateContent",
    });
    expect(err.isRateLimit).toBe(true);
    expect(err.retryAfterMs).toBe(2000);
    expect(err.service).toBe("gemini");
    expect(err.endpoint).toBe("generateContent");
  });
});

describe("isRateLimitError (008 seam)", () => {
  it("recognises the class form", () => {
    expect(isRateLimitError(new RateLimitError("x"))).toBe(true);
  });

  it("recognises a duck-typed marker (008's own error type)", () => {
    expect(isRateLimitError({ isRateLimit: true, retryAfterMs: 100 })).toBe(
      true,
    );
  });

  it("rejects ordinary errors and non-objects", () => {
    expect(isRateLimitError(new Error("boom"))).toBe(false);
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError("nope")).toBe(false);
    expect(isRateLimitError({ isRateLimit: false })).toBe(false);
  });
});

// The real cross-ticket proof: 009 catches an ACTUAL 008 error instance (not a
// hand-rolled literal) and can pull the fields it logs to state/rate-limits.md,
// all without 009 importing 008's class for the catch. If 008's error ever drops
// the marker or the log fields, this fails — exactly where the seam would break.
describe("008 ⇄ 009 seam: real GeminiRateLimitError flows through 009's guard", () => {
  it("isRateLimitError() recognises a real GeminiRateLimitError", () => {
    const err = new GeminiRateLimitError("gemini-2.5-pro", {
      retryAfterMs: 1500,
    });
    expect(isRateLimitError(err)).toBe(true);
  });

  it("exposes the service/endpoint/retryAfterMs 009's logger + backoff read", () => {
    const err = new GeminiRateLimitError("gemini-2.5-flash");
    expect(isRateLimitError(err)).toBe(true);
    if (isRateLimitError(err)) {
      expect(err.service).toBe("gemini");
      expect(err.endpoint).toBe("gemini-2.5-flash");
    }
  });
});
