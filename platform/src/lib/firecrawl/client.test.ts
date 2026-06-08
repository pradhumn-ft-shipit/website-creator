import { describe, expect, it, vi } from "vitest";

import { FirecrawlClient, type HttpBoundary, type HttpResponse } from "./client";
import { FirecrawlError, FirecrawlRateLimitError } from "./errors";
import { isRateLimitError } from "@/lib/inngest/errors";

function res(status: number, body: unknown): HttpResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

/** A boundary that yields queued responses in order, recording each request. */
function fakeHttp(
  responses: HttpResponse[],
): { http: HttpBoundary; calls: Array<{ url: string; method: string }> } {
  const calls: Array<{ url: string; method: string }> = [];
  let i = 0;
  const http: HttpBoundary = async (url, init) => {
    calls.push({ url, method: init?.method ?? "GET" });
    return responses[i++];
  };
  return { http: vi.fn(http), calls };
}

const noSleep = () => Promise.resolve();

function pageData(overrides: Record<string, unknown> = {}) {
  return {
    markdown: "# About us\nWe advise families.",
    html: "<h1>About</h1>",
    metadata: { title: "About", sourceURL: "https://acme.com/about" },
    ...overrides,
  };
}

describe("FirecrawlClient.crawl", () => {
  it("starts a crawl then polls until completed, normalising pages", async () => {
    const { http, calls } = fakeHttp([
      res(200, { id: "job-1" }), // POST /crawl
      res(200, { status: "scraping", total: 0, data: [] }), // poll #1
      res(200, {
        status: "completed",
        total: 2,
        data: [
          pageData(),
          pageData({ metadata: { title: "Home", sourceURL: "https://acme.com/" } }),
        ],
      }),
    ]);
    const client = new FirecrawlClient(http, "key", { sleep: noSleep });

    const result = await client.crawl("https://acme.com");

    expect(result.url).toBe("https://acme.com");
    expect(result.total).toBe(2);
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]).toMatchObject({
      url: "https://acme.com/about",
      title: "About",
    });
    expect(result.pages[0].markdown).toContain("We advise families");
    // First call is the POST start, subsequent are polls.
    expect(calls[0].method).toBe("POST");
    expect(calls[0].url).toMatch(/\/crawl$/);
    expect(calls[2].url).toMatch(/\/crawl\/job-1$/);
  });

  it("maps a 429 on start to a retryable FirecrawlRateLimitError (009 seam)", async () => {
    const { http } = fakeHttp([res(429, { error: "rate limited" })]);
    const client = new FirecrawlClient(http, "key", { sleep: noSleep });

    const err = await client.crawl("https://acme.com").catch((e) => e);
    expect(err).toBeInstanceOf(FirecrawlRateLimitError);
    // The pipeline's duck-typed guard must recognise it without importing us.
    expect(isRateLimitError(err)).toBe(true);
    expect(err.service).toBe("firecrawl");
  });

  it("maps a 429 during polling to a rate-limit error too", async () => {
    const { http } = fakeHttp([res(200, { id: "job-1" }), res(429, {})]);
    const client = new FirecrawlClient(http, "key", { sleep: noSleep });
    await expect(client.crawl("https://acme.com")).rejects.toBeInstanceOf(
      FirecrawlRateLimitError,
    );
  });

  it("throws FirecrawlError (not rate limit) when the job reports failed", async () => {
    const { http } = fakeHttp([
      res(200, { id: "job-1" }),
      res(200, { status: "failed" }),
    ]);
    const client = new FirecrawlClient(http, "key", { sleep: noSleep });
    const err = await client.crawl("https://acme.com").catch((e) => e);
    expect(err).toBeInstanceOf(FirecrawlError);
    expect(isRateLimitError(err)).toBe(false);
  });

  it("throws FirecrawlError when start returns no job id", async () => {
    const { http } = fakeHttp([res(200, { success: true })]);
    const client = new FirecrawlClient(http, "key", { sleep: noSleep });
    await expect(client.crawl("https://acme.com")).rejects.toBeInstanceOf(
      FirecrawlError,
    );
  });

  it("gives up with a FirecrawlError when polling never completes", async () => {
    const { http } = fakeHttp([
      res(200, { id: "job-1" }),
      res(200, { status: "scraping", data: [] }),
      res(200, { status: "scraping", data: [] }),
    ]);
    const client = new FirecrawlClient(http, "key", {
      sleep: noSleep,
      maxPollAttempts: 2,
    });
    await expect(client.crawl("https://acme.com")).rejects.toBeInstanceOf(
      FirecrawlError,
    );
  });

  it("falls back to the crawl root URL when a page has no sourceURL", async () => {
    const { http } = fakeHttp([
      res(200, { id: "j" }),
      res(200, {
        status: "completed",
        total: 1,
        data: [{ markdown: "x", metadata: { title: "T" } }],
      }),
    ]);
    const client = new FirecrawlClient(http, "key", { sleep: noSleep });
    const result = await client.crawl("https://acme.com");
    expect(result.pages[0].url).toBe("https://acme.com");
  });
});
