import { describe, expect, it } from "vitest";

import { estimateTokens } from "./tokens";

describe("estimateTokens", () => {
  it("returns 0 for empty input", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("scales roughly with length (~4 chars/token)", () => {
    const t = estimateTokens("a".repeat(400));
    expect(t).toBeGreaterThanOrEqual(100);
    expect(t).toBeLessThan(140);
  });

  it("never undercounts whitespace-heavy text below the word floor", () => {
    const words = "one two three four five";
    expect(estimateTokens(words)).toBeGreaterThanOrEqual(5);
  });
});
