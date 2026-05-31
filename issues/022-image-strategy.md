# 022 — Image strategy: stock search + capped AI images

**Epic:** AI pipeline orchestration
**Type:** AFK
**Blocks:** 024
**Blocked by:** 008, 009
**PRD trace:** §6.7 (image strategy), §6.6 (alt text), §8.4 (image budget), CLAUDE.md (AI-people hard stop)

## Slice
Supply the few images a site needs — stock first, capped AI fallback, never people.
- **images.generate (Inngest):** for image slots not filled by advisor uploads, search stock (Unsplash + Pexels, commercial-use, no attribution) first.
- **AI fallback (§6.7):** only when stock fails, generate via Gemini Flash Image (008) — **abstract / office / nature only**, **max 3 per site**, **never people / hands-with-documents / client-scenes**.
- **Outputs:** store as `assets` typed `ai_generated`; generate alt text (§6.6); ship `STOCK_PHOTO_CREDITS.md` in the repo.
- **Budget:** templates are minimal-by-design; prefer typography/whitespace over imagery.
- **Verify path:** a fixture needing one image resolves via stock; a no-stock fixture generates ≤1 AI image with alt text; attempting a person prompt is refused.

## Acceptance
- [ ] Stock search resolves image slots before any AI generation.
- [ ] AI generation only triggers on stock miss; hard cap of 3 per site enforced.
- [ ] No AI-generated people / hands-with-docs / client scenes — guarded in code, not just prompt.
- [ ] AI images stored as `ai_generated` assets with alt text; `STOCK_PHOTO_CREDITS.md` shipped.

## Notes
- **Hard stop (CLAUDE.md / §6.7):** AI-generated people are a compliance prohibition, not a style choice. Guard at the call boundary.
- Counts toward the per-site cost budget (008) — keep image use minimal.
