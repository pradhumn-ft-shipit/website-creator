/**
 * FirecrawlClient — the one place the scrape step (012) reaches Firecrawl
 * (PRD §4.1 step 7, §9.2 scrape.run). Follows the Gemini-client pattern: a thin
 * structural HTTP boundary is injected so unit tests pass a stub and there is no
 * live call; `firecrawlClient()` wires the real `fetch` + env key.
 *
 * We crawl (multi-page) rather than scrape a single page, because the sufficiency
 * check (§4.3) needs to know whether the site is a real multi-page site or a
 * one-pager/SPA we should route to the docs-upload fallback. The v1 crawl API is
 * async (start → poll), so the client owns the poll loop; `sleep` is injected so
 * tests run instantly.
 *
 * Errors: a 429 becomes the retryable `FirecrawlRateLimitError` (009 backs off);
 * everything else (auth, 5xx, job `failed`, malformed) becomes `FirecrawlError`,
 * which the scrape step treats as a route into the docs-upload fallback.
 */

import { FirecrawlError, FirecrawlRateLimitError } from "./errors";

const API_BASE = "https://api.firecrawl.dev/v1";

/** A page returned by a crawl, normalised to the fields intake cares about. */
export interface FirecrawlPage {
  url: string;
  markdown: string;
  html?: string;
  title?: string;
}

/** The normalised result the scrape step persists into `scrape_result_json`. */
export interface CrawlResult {
  /** The crawled root URL. */
  url: string;
  pages: FirecrawlPage[];
  /** Total pages Firecrawl reported for the job (may exceed `pages.length`). */
  total: number;
}

/** Minimal structural slice of `fetch` this client depends on. */
export type HttpResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};
export type HttpBoundary = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<HttpResponse>;

export interface FirecrawlClientOptions {
  /** Max pages to crawl (cost + budget guard). Default 25. */
  limit?: number;
  /** Poll interval between crawl-status checks, ms. Default 2000. */
  pollIntervalMs?: number;
  /** Max poll attempts before giving up with a FirecrawlError. Default 60. */
  maxPollAttempts?: number;
  /** Injected sleep (tests pass a no-op). Default real setTimeout. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Read a HTTP error body's retry-after hint if present (best-effort). */
function rateLimited(status: number): boolean {
  return status === 429;
}

export class FirecrawlClient {
  private readonly limit: number;
  private readonly pollIntervalMs: number;
  private readonly maxPollAttempts: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly http: HttpBoundary,
    private readonly apiKey: string,
    options: FirecrawlClientOptions = {},
  ) {
    this.limit = options.limit ?? 25;
    this.pollIntervalMs = options.pollIntervalMs ?? 2000;
    this.maxPollAttempts = options.maxPollAttempts ?? 60;
    this.sleep = options.sleep ?? defaultSleep;
  }

  /** Crawl `url` and return the aggregated, normalised pages. */
  async crawl(url: string): Promise<CrawlResult> {
    const jobId = await this.startCrawl(url);
    return this.pollCrawl(jobId, url);
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  private async startCrawl(url: string): Promise<string> {
    const endpoint = `${API_BASE}/crawl`;
    const res = await this.http(endpoint, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        url,
        limit: this.limit,
        scrapeOptions: { formats: ["markdown", "html"] },
      }),
    });
    if (rateLimited(res.status)) throw new FirecrawlRateLimitError(endpoint);
    if (!res.ok) {
      throw new FirecrawlError(`crawl start failed (${res.status})`, endpoint, {
        status: res.status,
      });
    }
    const body = (await res.json()) as { id?: string };
    if (!body?.id) {
      throw new FirecrawlError("crawl start returned no job id", endpoint);
    }
    return body.id;
  }

  private async pollCrawl(jobId: string, url: string): Promise<CrawlResult> {
    const endpoint = `${API_BASE}/crawl/${jobId}`;
    for (let attempt = 0; attempt < this.maxPollAttempts; attempt++) {
      const res = await this.http(endpoint, { headers: this.headers() });
      if (rateLimited(res.status)) throw new FirecrawlRateLimitError(endpoint);
      if (!res.ok) {
        throw new FirecrawlError(`crawl poll failed (${res.status})`, endpoint, {
          status: res.status,
        });
      }
      const body = (await res.json()) as {
        status?: string;
        total?: number;
        data?: Array<{
          markdown?: string;
          html?: string;
          metadata?: { title?: string; sourceURL?: string; url?: string };
        }>;
      };

      if (body.status === "failed") {
        throw new FirecrawlError("crawl job reported failed", endpoint);
      }
      if (body.status === "completed") {
        const pages: FirecrawlPage[] = (body.data ?? []).map((d) => ({
          url: d.metadata?.sourceURL ?? d.metadata?.url ?? url,
          markdown: d.markdown ?? "",
          html: d.html,
          title: d.metadata?.title,
        }));
        return { url, pages, total: body.total ?? pages.length };
      }
      // Still scraping — wait and poll again.
      await this.sleep(this.pollIntervalMs);
    }
    throw new FirecrawlError("crawl did not complete within the poll budget", endpoint);
  }
}

let singleton: FirecrawlClient | undefined;

/**
 * The real, env-wired client. Reads `FIRECRAWL_API_KEY`. Throws if missing so
 * misconfiguration fails fast rather than at the first live crawl. Memoised.
 */
export function firecrawlClient(options?: FirecrawlClientOptions): FirecrawlClient {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error(
      "FIRECRAWL_API_KEY is not set. Add it to .env.local (ticket 012).",
    );
  }
  if (options) return new FirecrawlClient(globalThis.fetch, apiKey, options);
  if (!singleton) singleton = new FirecrawlClient(globalThis.fetch, apiKey);
  return singleton;
}
