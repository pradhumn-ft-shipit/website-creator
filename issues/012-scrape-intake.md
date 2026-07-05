# 012 — Scrape (Firecrawl) + intake.process + docs-upload fallback

**Epic:** AI pipeline orchestration
**Type:** AFK
**Blocks:** 013, 020
**Blocked by:** 008, 009, 010
**PRD trace:** §4.1 (step 7), §4.2 (no-site path), §4.3 (scrape-failure fallback), §9.2 (scrape/intake steps), CLAUDE.md (Firecrawl fallback)

## Slice
Turn an advisor's existing site (or uploaded docs) into structured intake data.
- **scrape.run (Inngest):** Firecrawl crawl of `intake_data.existing_site_url`; handles JS render / robots / anti-bot.
- **Insufficient-content fallback (§4.3):** single-page/SPA/blocked → automatically fall through to the docs-upload path with the §4.3 message; log a soft-failure event; log rate-limit to `state/rate-limits.md`.
- **Docs-upload path (§4.2):** accept PDF/DOCX/TXT/MD/PPTX to Supabase Storage; text-only extraction (no image extraction in v1).
- **intake.process (Inngest):** Gemini (008) extracts the §8.3 Round-1 fields from scrape + uploads into `intake_data.structured_intake_json` with confidence + sources; extracts brand colors.
- **Verify path:** firing the pipeline on a seeded order populates `structured_intake_json`; a blocked-scrape fixture routes to docs-upload.

## Acceptance
- [~] Scrape of a real multi-page site populates `intake_data.scrape_result_json`. — crawl→persist built &
  unit-tested (`scrape.test.ts` proves the upsert); a **live** Firecrawl crawl is deferred (needs
  `FIRECRAWL_API_KEY` + Inngest dev, no Docker this session — same constraint as 001–009).
- [x] Insufficient content auto-routes to docs-upload with the §4.3 message + soft-failure log. — pure
  sufficiency check + pipeline `scrape_failed → docs_upload_fallback` branch + soft-failure note in
  `order_state_events` (`sufficiency.test.ts`, `pipeline.test.ts`). The advisor-facing §4.3 *message string*
  surfaces in **013**'s onboarding UI; the backend route + reason are done here.
- [x] Docs upload accepts all five formats; paths stored in `intake_data.uploaded_doc_paths`. — format
  validation + extraction (real mammoth/jszip in tests) + Storage write + path append/dedupe
  (`docs.test.ts`, `upload.test.ts`, `upload-service.test.ts`).
- [x] `intake.process` writes Round-1 fields (§8.3) with confidence + sources into `structured_intake_json`. —
  lenient Round-1 schema + `processIntake` persist (`schema.test.ts`, `extraction.test.ts`); live Gemini call
  deferred (key/Docker).
- [x] Firecrawl rate-limit triggers the documented fallback + a `state/rate-limits.md` entry. — 429 →
  `FirecrawlRateLimitError` (carries `isRateLimit` marker) rethrown → pipeline `handleStepFailure` logs to
  `state/rate-limits.md` + Inngest backoff, NOT docs-fallback (`client.test.ts`, `scrape.test.ts`, existing
  `pipeline.test.ts` rate-limit path).

## Notes
- Both paths converge on the same Gemini extraction pipeline (§4.2).
- Brand colors extracted here feed template-selection previews (013) and generation voice/style.
