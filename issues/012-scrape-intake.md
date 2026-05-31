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
- [ ] Scrape of a real multi-page site populates `intake_data.scrape_result_json`.
- [ ] Insufficient content auto-routes to docs-upload with the §4.3 message + soft-failure log.
- [ ] Docs upload accepts all five formats; paths stored in `intake_data.uploaded_doc_paths`.
- [ ] `intake.process` writes Round-1 fields (§8.3) with confidence + sources into `structured_intake_json`.
- [ ] Firecrawl rate-limit triggers the documented fallback + a `state/rate-limits.md` entry.

## Notes
- Both paths converge on the same Gemini extraction pipeline (§4.2).
- Brand colors extracted here feed template-selection previews (015) and generation voice/style.
