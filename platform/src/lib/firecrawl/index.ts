/**
 * Public surface of the Firecrawl module — the only entry point the scrape step
 * (012) imports. HTTP + poll details stay internal.
 */

export {
  FirecrawlClient,
  firecrawlClient,
  type FirecrawlPage,
  type CrawlResult,
  type HttpBoundary,
  type HttpResponse,
  type FirecrawlClientOptions,
} from "./client";

export { FirecrawlError, FirecrawlRateLimitError } from "./errors";
