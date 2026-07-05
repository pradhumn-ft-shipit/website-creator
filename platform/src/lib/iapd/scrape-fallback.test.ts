import { describe, expect, it } from "vitest";

import type { CrawlResult } from "@/lib/firecrawl";

import { findComplianceDocsInCrawl } from "./scrape-fallback";

function crawl(pages: Array<{ url: string; html?: string }>): CrawlResult {
  return {
    url: pages[0]?.url ?? "https://acme.com",
    total: pages.length,
    pages: pages.map((p) => ({ url: p.url, markdown: "", html: p.html })),
  };
}

describe("findComplianceDocsInCrawl", () => {
  it("finds a Form CRS PDF link by its text", () => {
    const result = findComplianceDocsInCrawl(
      crawl([
        {
          url: "https://acme.com/disclosures",
          html: `<a href="/docs/relationship-summary.pdf">Form CRS</a>`,
        },
      ]),
    );
    expect(result).toEqual([
      { kind: "crs", filename: "relationship-summary.pdf", url: "https://acme.com/docs/relationship-summary.pdf" },
    ]);
  });

  it("finds an ADV Part 2A brochure and a 2B supplement as separate documents", () => {
    const result = findComplianceDocsInCrawl(
      crawl([
        {
          url: "https://acme.com/about",
          html: `
            <a href="/adv-part-2a.pdf">Form ADV Part 2A Brochure</a>
            <a href="/adv-part-2b.pdf">Form ADV Part 2B Supplement</a>
          `,
        },
      ]),
    );
    expect(result.map((d) => d.kind).sort()).toEqual(["adv2a", "adv2b"]);
  });

  it("takes the first match per kind and ignores duplicates across pages", () => {
    const result = findComplianceDocsInCrawl(
      crawl([
        { url: "https://acme.com/a", html: `<a href="/crs-1.pdf">Form CRS</a>` },
        { url: "https://acme.com/b", html: `<a href="/crs-2.pdf">Form CRS</a>` },
      ]),
    );
    expect(result).toHaveLength(1);
    expect(result[0].url).toContain("crs-1.pdf");
  });

  it("returns nothing when no PDF links are present", () => {
    const result = findComplianceDocsInCrawl(
      crawl([{ url: "https://acme.com", html: "<p>No documents here.</p>" }]),
    );
    expect(result).toEqual([]);
  });

  it("returns nothing when pages have no HTML captured", () => {
    const result = findComplianceDocsInCrawl(crawl([{ url: "https://acme.com" }]));
    expect(result).toEqual([]);
  });

  it("returns nothing for a null/empty crawl", () => {
    expect(findComplianceDocsInCrawl(null)).toEqual([]);
    expect(findComplianceDocsInCrawl(undefined)).toEqual([]);
    expect(findComplianceDocsInCrawl({ url: "x", total: 0, pages: [] })).toEqual([]);
  });
});
