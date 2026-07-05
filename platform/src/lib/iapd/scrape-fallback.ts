/**
 * §5.4 fallback step 2: "Fall back to scrape from existing site if IAPD fetch
 * fails." The scrape step (012) already crawled the advisor's existing site
 * earlier in the pipeline and persisted it to `intake_data.scrape_result_json`
 * — this module re-uses that crawl (no second Firecrawl call) and looks for a
 * link to a Form ADV brochure or Form CRS PDF among the crawled pages' HTML.
 *
 * Deliberately conservative: only fires when the site actually links a PDF
 * whose URL or link text names the document (e.g. "Form CRS", "ADV Part 2").
 * No match → the caller moves to the final fallback (advisor upload prompt).
 */

import type { CrawlResult } from "@/lib/firecrawl";

import type { IapdDocument } from "./client";

/** Matches an href to a PDF alongside link text/URL naming the document. */
const CRS_PATTERN = /form[\s_-]?crs|\bcrs\b/i;
const ADV_2B_PATTERN = /adv[\s_-]?(part)?[\s_-]?2\s?-?b/i;
const ADV_2A_PATTERN = /adv|brochure/i;

interface FoundLink {
  href: string;
  text: string;
}

/** Pull `<a href="...">text</a>` pairs whose href points at a PDF. */
function extractPdfLinks(html: string, baseUrl: string): FoundLink[] {
  const links: FoundLink[] = [];
  const anchorRe = /<a\b[^>]*href=["']([^"']+\.pdf[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorRe.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].replace(/<[^>]+>/g, " ").trim();
    let resolved = href;
    try {
      resolved = new URL(href, baseUrl).toString();
    } catch {
      // relative-URL resolution failed; keep the raw href.
    }
    links.push({ href: resolved, text });
  }
  return links;
}

function classifyLink(link: FoundLink): IapdDocument["kind"] | null {
  const haystack = `${link.text} ${link.href}`;
  if (CRS_PATTERN.test(haystack)) return "crs";
  if (ADV_2B_PATTERN.test(haystack)) return "adv2b";
  if (ADV_2A_PATTERN.test(haystack)) return "adv2a";
  return null;
}

/**
 * Scan an already-crawled site for ADV/CRS document links. Returns at most one
 * document per kind (first match wins), matching the shape `IapdClient`
 * returns so the service layer can download + store them identically.
 */
export function findComplianceDocsInCrawl(crawl: CrawlResult | null | undefined): IapdDocument[] {
  if (!crawl?.pages?.length) return [];

  const found = new Map<IapdDocument["kind"], IapdDocument>();
  for (const page of crawl.pages) {
    if (!page.html) continue;
    for (const link of extractPdfLinks(page.html, page.url)) {
      const kind = classifyLink(link);
      if (!kind || found.has(kind)) continue;
      const filename = link.href.split("/").pop()?.split("?")[0] || `${kind}.pdf`;
      found.set(kind, { kind, filename, url: link.href });
    }
  }
  return Array.from(found.values());
}
