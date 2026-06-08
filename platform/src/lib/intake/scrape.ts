/**
 * scrape.run (PRD §4.1 step 7, §9.2) — the IO body the pipeline's scrape step
 * runs. Reads the order's `existing_site_url`, crawls it via Firecrawl, persists
 * the raw result into `intake_data.scrape_result_json`, and decides the route:
 *
 *   - proceed       → enough content to build intake from (§4.3 sufficiency).
 *   - docs_fallback → no URL (§4.2 no-site path), a hard scrape failure
 *                     (anti-bot / 5xx, surfaced as FirecrawlError), or content
 *                     too thin (§4.3). The pipeline then routes to the
 *                     docs-upload state and the advisor uploads documents.
 *
 * A rate-limit error is NOT caught here: it propagates to the pipeline's
 * `handleStepFailure`, which logs it to state/rate-limits.md and lets Inngest
 * back off + retry (CLAUDE.md Firecrawl fallback — retry, don't fall through on
 * a transient limit). Only a *hard* failure or insufficient content falls
 * through to docs-upload.
 *
 * Pure decision (route + reason) is returned; the pipeline owns the state
 * transitions so the state machine stays in one place.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import {
  FirecrawlError,
  firecrawlClient,
  type CrawlResult,
  type FirecrawlClient,
} from "@/lib/firecrawl";

import { isContentSufficient, type InsufficientReason } from "./sufficiency";

type AdminClient = SupabaseClient<Database>;

export type ScrapeReason = InsufficientReason | "no_url" | "scrape_error";

export type ScrapeOutcome =
  | { route: "proceed"; result: CrawlResult }
  | { route: "docs_fallback"; reason: ScrapeReason };

export interface ScrapeDeps {
  client: AdminClient;
  orderId: string;
  /** Injectable for tests; defaults to the env-wired Firecrawl client. */
  firecrawl?: Pick<FirecrawlClient, "crawl">;
}

/** Read the order's intake row (URL lives here; created by onboarding 013). */
async function readIntakeUrl(
  client: AdminClient,
  orderId: string,
): Promise<string | null> {
  const { data } = await client
    .from("intake_data")
    .select("existing_site_url")
    .eq("order_id", orderId)
    .maybeSingle();
  return data?.existing_site_url ?? null;
}

/** Persist the crawl result, creating the intake row if it doesn't exist yet. */
async function persistScrapeResult(
  client: AdminClient,
  orderId: string,
  result: CrawlResult,
): Promise<void> {
  await client
    .from("intake_data")
    .upsert(
      { order_id: orderId, scrape_result_json: result as unknown as Database["public"]["Tables"]["intake_data"]["Insert"]["scrape_result_json"] },
      { onConflict: "order_id" },
    );
}

export async function runScrape(deps: ScrapeDeps): Promise<ScrapeOutcome> {
  const { client, orderId } = deps;
  const url = await readIntakeUrl(client, orderId);

  // §4.2 no-site path: nothing to scrape, go straight to docs upload. Not a
  // failure — the advisor chose "no existing website" — so no soft-failure note.
  if (!url) return { route: "docs_fallback", reason: "no_url" };

  const firecrawl = deps.firecrawl ?? firecrawlClient();

  let result: CrawlResult;
  try {
    result = await firecrawl.crawl(url);
  } catch (err) {
    // A hard (non-rate-limit) scrape failure — anti-bot block, 5xx, job failed.
    // §4.3: fall through to docs-upload. Rate-limit errors are NOT caught here;
    // they propagate so Inngest backs off (CLAUDE.md fallback policy).
    if (err instanceof FirecrawlError) {
      return { route: "docs_fallback", reason: "scrape_error" };
    }
    throw err;
  }

  // Keep whatever we pulled, even if insufficient — useful for debugging and the
  // admin order view.
  await persistScrapeResult(client, orderId, result);

  const verdict = isContentSufficient(result);
  if (!verdict.sufficient) {
    return { route: "docs_fallback", reason: verdict.reason };
  }
  return { route: "proceed", result };
}
