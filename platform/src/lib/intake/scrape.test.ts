import { describe, expect, it } from "vitest";

import type { CrawlResult } from "@/lib/firecrawl";
import { FirecrawlError, FirecrawlRateLimitError } from "@/lib/firecrawl";
import { runScrape } from "./scrape";
import { MIN_PAGE_CONTENT_CHARS } from "./sufficiency";

/**
 * Minimal intake_data double: holds one row keyed by order_id; supports
 * `.select().eq().maybeSingle()` and `.upsert()`.
 */
function makeClient(row: { existing_site_url?: string | null } | null) {
  const upserts: Array<Record<string, unknown>> = [];
  const state = { row };
  const client = {
    from(table: string) {
      if (table !== "intake_data") throw new Error(`unexpected table ${table}`);
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({ data: state.row, error: null }),
              };
            },
          };
        },
        upsert: async (payload: Record<string, unknown>) => {
          upserts.push(payload);
          state.row = { ...(state.row ?? {}), ...payload };
          return { data: null, error: null };
        },
      };
    },
  };
  return { client, upserts };
}

const body = "x".repeat(MIN_PAGE_CONTENT_CHARS + 50);

function crawlResult(markdowns: string[]): CrawlResult {
  return {
    url: "https://acme.com",
    total: markdowns.length,
    pages: markdowns.map((m, i) => ({ url: `https://acme.com/${i}`, markdown: m })),
  };
}

function fakeFirecrawl(result: CrawlResult | Error) {
  return {
    crawl: async () => {
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

describe("runScrape (§4.1 step 7, §4.3)", () => {
  it("proceeds and persists scrape_result_json for a sufficient site", async () => {
    const { client, upserts } = makeClient({ existing_site_url: "https://acme.com" });
    const result = crawlResult([body, body, body]);

    const outcome = await runScrape({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: client as any,
      orderId: "order-1",
      firecrawl: fakeFirecrawl(result),
    });

    expect(outcome.route).toBe("proceed");
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({ order_id: "order-1" });
    expect(upserts[0].scrape_result_json).toEqual(result);
  });

  it("routes to docs_fallback with no_url when the order has no site URL (§4.2)", async () => {
    const { client, upserts } = makeClient({ existing_site_url: null });
    const outcome = await runScrape({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: client as any,
      orderId: "order-1",
      firecrawl: fakeFirecrawl(crawlResult([body, body])),
    });
    expect(outcome).toEqual({ route: "docs_fallback", reason: "no_url" });
    // Never crawled, never persisted.
    expect(upserts).toHaveLength(0);
  });

  it("routes to docs_fallback (no row at all) without crawling", async () => {
    const { client } = makeClient(null);
    const outcome = await runScrape({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: client as any,
      orderId: "order-1",
      firecrawl: fakeFirecrawl(crawlResult([body, body])),
    });
    expect(outcome).toMatchObject({ route: "docs_fallback", reason: "no_url" });
  });

  it("routes to docs_fallback on insufficient content (§4.3 single-page)", async () => {
    const { client, upserts } = makeClient({ existing_site_url: "https://acme.com" });
    const outcome = await runScrape({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: client as any,
      orderId: "order-1",
      firecrawl: fakeFirecrawl(crawlResult([body])), // one page only
    });
    expect(outcome).toEqual({ route: "docs_fallback", reason: "single_page" });
    // We still persisted what we pulled, for debugging / admin view.
    expect(upserts).toHaveLength(1);
  });

  it("routes to docs_fallback on a hard scrape failure (anti-bot/5xx)", async () => {
    const { client } = makeClient({ existing_site_url: "https://acme.com" });
    const outcome = await runScrape({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: client as any,
      orderId: "order-1",
      firecrawl: fakeFirecrawl(new FirecrawlError("blocked", "ep")),
    });
    expect(outcome).toEqual({ route: "docs_fallback", reason: "scrape_error" });
  });

  it("rethrows a rate-limit error (Inngest backoff, NOT docs-fallback)", async () => {
    const { client } = makeClient({ existing_site_url: "https://acme.com" });
    await expect(
      runScrape({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client: client as any,
        orderId: "order-1",
        firecrawl: fakeFirecrawl(new FirecrawlRateLimitError("ep")),
      }),
    ).rejects.toBeInstanceOf(FirecrawlRateLimitError);
  });
});
