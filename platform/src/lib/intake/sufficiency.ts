/**
 * Scrape sufficiency check (PRD §4.3) — pure, no IO.
 *
 * §4.3 routes a scrape to the docs-upload fallback when Firecrawl "returns
 * insufficient content (single-page site, JS-only SPA we cannot render, scrape
 * blocked by anti-bot)." We can't distinguish *why* from the result alone, so we
 * judge the observable signal: how many pages carried real text, and how much.
 * A one-pager, an empty/blocked crawl, and a JS shell that rendered no copy all
 * collapse to the same verdict — not enough content to build from.
 *
 * Thresholds are deliberately conservative and named so they can be tuned in
 * alpha without hunting through logic. The reason code feeds the soft-failure
 * event the scrape step logs (§4.3, internal analytics).
 */

import type { CrawlResult } from "@/lib/firecrawl";

/** Minimum markdown chars for a page to count as "has real content". */
export const MIN_PAGE_CONTENT_CHARS = 200;
/** Minimum number of content-bearing pages for a site to be "multi-page". */
export const MIN_CONTENT_PAGES = 2;
/** Minimum total content chars across all pages. */
export const MIN_TOTAL_CONTENT_CHARS = 600;

export type InsufficientReason =
  | "no_pages"
  | "single_page"
  | "insufficient_text";

export type SufficiencyVerdict =
  | { sufficient: true }
  | { sufficient: false; reason: InsufficientReason };

/** Decide whether a crawl produced enough to build intake from (§4.3). */
export function isContentSufficient(result: CrawlResult): SufficiencyVerdict {
  const contentPages = result.pages.filter(
    (p) => (p.markdown?.trim().length ?? 0) >= MIN_PAGE_CONTENT_CHARS,
  );
  const totalChars = result.pages.reduce(
    (sum, p) => sum + (p.markdown?.trim().length ?? 0),
    0,
  );

  if (contentPages.length === 0) {
    return { sufficient: false, reason: "no_pages" };
  }
  if (contentPages.length < MIN_CONTENT_PAGES) {
    return { sufficient: false, reason: "single_page" };
  }
  if (totalChars < MIN_TOTAL_CONTENT_CHARS) {
    return { sufficient: false, reason: "insufficient_text" };
  }
  return { sufficient: true };
}
