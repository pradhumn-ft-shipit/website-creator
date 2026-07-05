/**
 * iapd.fetch (PRD §5.4, §9.2) — the IO body the pipeline's iapd step runs, and
 * the reusable operation the dashboard's "Refresh from SEC IAPD" button (030)
 * calls directly.
 *
 * Fallback chain (§5.4, CLAUDE.md "SEC IAPD unavailable → fall back to scrape,
 * then to direct upload"):
 *   1. IAPD fetch by CRD — Form ADV Part 2A/2B + Form CRS PDFs.
 *   2. IAPD fails (CRD not found / malformed / 5xx) → look for the same
 *      documents among the site the order already crawled (012's
 *      `scrape_result_json`) — no second Firecrawl call.
 *   3. Neither produces a document → route "upload_prompt": the advisor is
 *      asked to upload the missing document directly (dashboard Assets tab).
 *
 * A rate-limit error is NOT caught here — same posture as 012's scrape step —
 * it propagates to the pipeline's `handleStepFailure`, which logs it and lets
 * Inngest back off + retry (transient, not "unavailable").
 *
 * Documents are stored under the account's asset namespace in the public
 * `customer-assets` bucket (public so the generated site's footer can link
 * directly, §5.4 point 4) and recorded as typed `assets` rows (`doc_adv` /
 * `doc_crs`). A re-fetch replaces prior rows via the existing
 * `assets.replaced_from_id` audit chain rather than deleting them.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { AppError } from "@/lib/api/envelope";
import type { Database } from "@/types/database.types";
import type { CrawlResult } from "@/lib/firecrawl";

import { IapdError, IapdRateLimitError } from "./errors";
import { IapdClient, iapdClient, type IapdDocument } from "./client";
import { findComplianceDocsInCrawl } from "./scrape-fallback";
import { appendRateLimitLog, type RateLimitEntry } from "@/lib/inngest/rate-limit-log";

type AdminClient = SupabaseClient<Database>;

export const ASSETS_BUCKET = "customer-assets";

/** Maps an IAPD/scraped document kind to its `assets.type` value. */
function assetType(kind: IapdDocument["kind"]): "doc_adv" | "doc_crs" {
  return kind === "crs" ? "doc_crs" : "doc_adv";
}

export type IapdFetchOutcome =
  | { route: "stored"; source: "iapd" | "scrape"; assetIds: string[] }
  | { route: "skipped"; reason: "no_crd" }
  | { route: "upload_prompt"; reason: "iapd_and_scrape_unavailable" | "no_documents_found" };

export interface IapdFetchDeps {
  client: AdminClient;
  accountId: string;
  /** Only needed by the pipeline step, which already has the order id, to read
   * the existing crawl for the scrape fallback. The dashboard refresh (030)
   * calling this directly for an account with no in-flight order can omit it —
   * the scrape fallback is then simply unavailable (falls to upload_prompt). */
  orderId?: string;
  /** Pass a specific CRD (e.g. from a not-yet-persisted onboarding answer);
   * defaults to reading `accounts.crd_number`. */
  crdNumber?: string | null;
  /** Injectable for tests; defaults to the real fetch-wired client. */
  iapd?: Pick<IapdClient, "fetchFirmRecord" | "downloadDocument">;
  /** Injectable for tests. */
  logUnavailability?: (e: RateLimitEntry) => Promise<void>;
}

async function readCrdNumber(client: AdminClient, accountId: string): Promise<string | null> {
  const { data } = await client
    .from("accounts")
    .select("crd_number")
    .eq("id", accountId)
    .maybeSingle();
  return (data as { crd_number: string | null } | null)?.crd_number ?? null;
}

async function readCrawlForOrder(
  client: AdminClient,
  orderId: string | undefined,
): Promise<CrawlResult | null> {
  if (!orderId) return null;
  const { data } = await client
    .from("intake_data")
    .select("scrape_result_json")
    .eq("order_id", orderId)
    .maybeSingle();
  return (data?.scrape_result_json as unknown as CrawlResult | null) ?? null;
}

/** Most recent asset of `type` for this account, if any (replacement target). */
async function latestAssetOfType(
  client: AdminClient,
  accountId: string,
  type: "doc_adv" | "doc_crs",
): Promise<{ id: string } | null> {
  const { data } = await client
    .from("assets")
    .select("id")
    .eq("account_id", accountId)
    .eq("type", type)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null) ?? null;
}

/** Download one document and record it as a typed, replace-chained asset. */
async function storeComplianceAsset(
  client: AdminClient,
  accountId: string,
  doc: IapdDocument,
  bytes: Uint8Array,
): Promise<string> {
  const type = assetType(doc.kind);
  const path = `${accountId}/compliance/${type}-${Date.now()}-${doc.filename}`;

  const { error: uploadError } = await client.storage
    .from(ASSETS_BUCKET)
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (uploadError) {
    throw new AppError(`Failed to store ${doc.filename}.`, "iapd_asset_upload_failed", 502);
  }

  const previous = await latestAssetOfType(client, accountId, type);

  const { data, error: insertError } = await client
    .from("assets")
    .insert({
      account_id: accountId,
      type,
      storage_path: path,
      original_filename: doc.filename,
      replaced_from_id: previous?.id ?? null,
    })
    .select("id")
    .single();
  if (insertError || !data) {
    throw new AppError("Failed to record compliance asset.", "iapd_asset_record_failed", 502);
  }
  return (data as { id: string }).id;
}

/**
 * Fetch (or re-fetch) an account's ADV/CRS documents and store them. Reusable
 * by both the pipeline's iapd step and the dashboard's manual refresh button
 * (030) — the dashboard passes only `client` + `accountId`.
 */
export async function fetchIapdDocuments(deps: IapdFetchDeps): Promise<IapdFetchOutcome> {
  const { client, accountId } = deps;
  const crd = deps.crdNumber !== undefined ? deps.crdNumber : await readCrdNumber(client, accountId);
  if (!crd) return { route: "skipped", reason: "no_crd" };

  const iapd = deps.iapd ?? iapdClient();
  const logUnavailability = deps.logUnavailability ?? appendRateLimitLog;

  let documents: IapdDocument[] = [];
  let source: "iapd" | "scrape" = "iapd";
  let iapdFailed = false;

  try {
    const record = await iapd.fetchFirmRecord(crd);
    documents = record.documents;
  } catch (err) {
    if (err instanceof IapdRateLimitError) throw err; // propagate for Inngest backoff

    // Hard IAPD failure (not found / malformed / 5xx) — log unavailability
    // (CLAUDE.md fallback log) then fall back to the already-crawled site.
    if (err instanceof IapdError) {
      iapdFailed = true;
      await logUnavailability({
        service: "iapd",
        endpoint: err.endpoint,
        timestamp: new Date().toISOString(),
        code: "iapd_unavailable",
        fallback: "scrape fallback, then advisor upload prompt (PRD §5.4)",
      });
    } else {
      throw err;
    }
  }

  // Only attempt the scrape fallback when IAPD itself was unavailable — a
  // successful IAPD lookup that simply lists no brochures is a distinct
  // (rarer) outcome, not "IAPD unavailable" (§5.4 fallback chain step 2).
  if (documents.length === 0 && iapdFailed) {
    const crawl = await readCrawlForOrder(client, deps.orderId);
    documents = findComplianceDocsInCrawl(crawl);
    source = "scrape";
  }

  if (documents.length === 0) {
    return {
      route: "upload_prompt",
      reason: iapdFailed ? "iapd_and_scrape_unavailable" : "no_documents_found",
    };
  }

  const assetIds: string[] = [];
  for (const doc of documents) {
    const bytes = await iapd.downloadDocument(doc);
    assetIds.push(await storeComplianceAsset(client, accountId, doc, bytes));
  }
  return { route: "stored", source, assetIds };
}
