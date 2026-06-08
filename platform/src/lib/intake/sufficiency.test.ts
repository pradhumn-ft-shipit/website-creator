import { describe, expect, it } from "vitest";

import type { CrawlResult } from "@/lib/firecrawl";
import {
  isContentSufficient,
  MIN_PAGE_CONTENT_CHARS,
} from "./sufficiency";

function crawl(markdowns: string[]): CrawlResult {
  return {
    url: "https://acme.com",
    total: markdowns.length,
    pages: markdowns.map((m, i) => ({
      url: `https://acme.com/${i}`,
      markdown: m,
    })),
  };
}

const body = "x".repeat(MIN_PAGE_CONTENT_CHARS);

describe("isContentSufficient (§4.3)", () => {
  it("accepts a real multi-page site with ample text", () => {
    expect(isContentSufficient(crawl([body, body, body]))).toEqual({
      sufficient: true,
    });
  });

  it("rejects an empty/blocked crawl as no_pages", () => {
    expect(isContentSufficient(crawl([]))).toEqual({
      sufficient: false,
      reason: "no_pages",
    });
  });

  it("treats whitespace-only pages as no content (anti-bot/JS shell)", () => {
    expect(isContentSufficient(crawl(["   ", "\n\n"]))).toMatchObject({
      sufficient: false,
      reason: "no_pages",
    });
  });

  it("rejects a single-page site (§4.3 explicit case)", () => {
    expect(isContentSufficient(crawl([body]))).toEqual({
      sufficient: false,
      reason: "single_page",
    });
  });

  it("rejects multi-page but thin content as insufficient_text", () => {
    // Two pages that each just clear the per-page bar but fall short overall.
    const thin = "y".repeat(MIN_PAGE_CONTENT_CHARS);
    const verdict = isContentSufficient({
      url: "https://acme.com",
      total: 2,
      pages: [
        { url: "a", markdown: thin },
        { url: "b", markdown: thin.slice(0, MIN_PAGE_CONTENT_CHARS) },
      ],
    });
    // 200 + 200 = 400 < 600 total threshold.
    expect(verdict).toEqual({ sufficient: false, reason: "insufficient_text" });
  });

  it("ignores pages below the per-page content bar when counting", () => {
    expect(isContentSufficient(crawl([body, "tiny"]))).toMatchObject({
      sufficient: false,
      reason: "single_page",
    });
  });
});
