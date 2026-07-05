# 014 — SEC IAPD auto-pull step

**Epic:** AI pipeline orchestration
**Type:** AFK
**Blocks:** 030
**Blocked by:** 002, 009
**PRD trace:** §5.4 (IAPD auto-pull), §5.5 (registration), CLAUDE.md (IAPD → scrape → upload fallback chain)

## Slice
Pull authoritative ADV/CRS documents by CRD so the generated site's footer links to the real filings.
- **iapd.fetch (Inngest):** when `accounts.crd_number` present, fetch the firm record from the authoritative SEC IAPD endpoint (`adviserinfo.sec.gov`); pull Form ADV Part 2A/2B + Form CRS PDFs.
- **Store:** save to Supabase Storage under the customer's asset namespace; create `assets` rows typed `doc_adv` / `doc_crs`.
- **Fallback chain (§5.4):** IAPD fail → scrape from existing site → direct-upload prompt. Log IAPD unavailability to `state/rate-limits.md`.
- **Re-fetch hook:** expose the operation for the dashboard "Refresh from SEC IAPD" button (used by 030).
- **Verify path:** a known test CRD pulls and stores the three documents as typed assets.

## Acceptance
- [x] Valid CRD pulls ADV 2A/2B + CRS and stores them as `doc_adv`/`doc_crs` assets.
      Proven against a mocked IAPD HTTP boundary (`client.test.ts`) + the full
      store path (`service.test.ts` "a known test CRD pulls and stores ADV
      2A/2B + CRS as typed doc_adv/doc_crs assets" — 3 assets, correct types,
      correct bucket). Live IAPD network call itself is untested (no live
      access this session — same posture as 008/012).
- [x] IAPD failure falls back to scrape, then to the upload prompt (§5.4 chain).
      `service.ts#fetchIapdDocuments`: hard IAPD failure → re-uses the crawl
      012's scrape step already captured (`scrape-fallback.ts` scans crawled
      pages' HTML for ADV/CRS PDF links, no second Firecrawl call) → if that
      also finds nothing, routes `upload_prompt`. All three legs covered by
      tests (IAPD→scrape success, IAPD+scrape both empty, IAPD success but
      zero brochures).
- [x] IAPD unavailability is logged to `state/rate-limits.md`.
      Reuses 009's `appendRateLimitLog` (the shared external-API-fallback log,
      not literally rate-limit-only — see the file's own "SEC IAPD unavailable"
      row) with `code:"iapd_unavailable"`; asserted in `service.test.ts`.
      A genuine 429 is a *distinct*, retryable `IapdRateLimitError` that
      propagates to the pipeline's `handleStepFailure` for Inngest backoff
      (not logged as "unavailable" — it's transient).
- [x] The fetch operation is reusable by the dashboard refresh button (030).
      `fetchIapdDocuments({ client, accountId })` takes only an account id
      (re-reads `crd_number`, re-derives the replace-chain via
      `assets.replaced_from_id`); the pipeline step is a thin wrapper that adds
      `orderId` (for the scrape-fallback read). 030 calls the same export.
- [x] Footer link targets (asset URLs) are available to build/assembly (024).
      Documents are stored in the new **public** `customer-assets` bucket
      (migration `20260705120000`) rather than the private `intake-docs`
      bucket — 024 can derive a public URL via
      `client.storage.from('customer-assets').getPublicUrl(asset.storage_path)`
      off the `assets` rows this ticket writes.

## Notes
- Re-fetch is **manual only** in v1 (§3.2, §5.4) — no real-time sync. Do not build a sync cron.
- These docs are compliance-required footer elements (§5.3) — their absence is a Layer-2 failure.
