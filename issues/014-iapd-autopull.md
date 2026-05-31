# 014 — SEC IAPD auto-pull step

**Epic:** AI pipeline orchestration
**Type:** AFK
**Blocks:** 024, 030
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
- [ ] Valid CRD pulls ADV 2A/2B + CRS and stores them as `doc_adv`/`doc_crs` assets.
- [ ] IAPD failure falls back to scrape, then to the upload prompt (§5.4 chain).
- [ ] IAPD unavailability is logged to `state/rate-limits.md`.
- [ ] The fetch operation is reusable by the dashboard refresh button (030).
- [ ] Footer link targets (asset URLs) are available to build/assembly (024).

## Notes
- Re-fetch is **manual only** in v1 (§3.2, §5.4) — no real-time sync. Do not build a sync cron.
- These docs are compliance-required footer elements (§5.3) — their absence is a Layer-2 failure.
