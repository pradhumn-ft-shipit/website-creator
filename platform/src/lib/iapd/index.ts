/**
 * Public surface of the iapd module (014). The pipeline (009) imports
 * `fetchIapdDocuments`; the dashboard "Refresh from SEC IAPD" button (030)
 * imports the same function directly (accountId-only call).
 */

export { IapdClient, iapdClient, type IapdDocument, type IapdFirmRecord } from "./client";
export { IapdError, IapdRateLimitError } from "./errors";
export { findComplianceDocsInCrawl } from "./scrape-fallback";
export {
  fetchIapdDocuments,
  ASSETS_BUCKET,
  type IapdFetchDeps,
  type IapdFetchOutcome,
} from "./service";
