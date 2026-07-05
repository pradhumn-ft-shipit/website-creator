# 022 — Generated-site images (stock + capped AI) + legal / hygiene pages

**Epic:** AI pipeline orchestration
**Type:** AFK
**Blocks:** 024
**Blocked by:** 008, 009, 002, 005
**PRD trace:** §6.7 (image strategy), §6.6 (alt text), §8.4 (image budget), §6.9 (hygiene pages), §14.1 (generated-site legal), CLAUDE.md (AI-people hard stop)

> **Consolidates former 022 + 023.** Both produce the *secondary* content the assembled site needs
> beyond copy — images and the legal/hygiene pages — both are AFK and both block 024 (build). Grouped
> as "everything the build needs that isn't the main copy or the template shell."

## Slice

### Images (§6.7)
- **images.generate (Inngest):** for image slots not filled by advisor uploads, search stock (Unsplash + Pexels, commercial-use, no attribution) **first**.
- **AI fallback (§6.7):** only on stock miss, generate via Gemini Flash Image (008) — **abstract / office / nature only**, **max 3 per site**, **never people / hands-with-documents / client-scenes** (guarded at the call boundary, not just in the prompt).
- **Outputs:** store as `assets` typed `ai_generated`; generate alt text (§6.6); ship `STOCK_PHOTO_CREDITS.md` in the repo. Templates are minimal-by-design — prefer typography/whitespace over imagery; counts toward the per-site cost budget (008).

### Legal / hygiene pages (§14.1, §6.9)
- **Privacy Policy (§14.1):** generated per industry + state of operation; covers contact-form data collection (Reg S-P aware).
- **ToS / Disclaimer (§14.1):** "for informational purposes only," no advice via website, limited advisor liability.
- **404 (§6.9):** matches the chosen template aesthetic, "Back home" link, search prompt.
- **Output:** content objects consumable by the templates/build (024), placed at the correct routes; these pages are the linked targets of 016's ruleset-driven footer. Privacy/ToS are **required** pages (cannot be removed via edit chat — §4.4).

## Acceptance
- [ ] Stock search resolves image slots before any AI generation; AI only triggers on stock miss; hard cap of 3/site enforced.
- [ ] No AI-generated people / hands-with-docs / client scenes — guarded in code, not just prompt.
- [ ] AI images stored as `ai_generated` assets with alt text; `STOCK_PHOTO_CREDITS.md` shipped.
- [ ] Privacy Policy generated per industry+state; covers contact-form collection; state-specific differences appear for state-registered fixtures.
- [ ] ToS/Disclaimer generated with the §14.1 limitations.
- [ ] 404 matches the chosen template aesthetic.
- [ ] Legal pages wired as the footer's linked targets (with 016).

## Notes
- **Hard stop (CLAUDE.md / §6.7):** AI-generated people are a compliance prohibition, not a style choice. Guard at the call boundary.
- Generated-site legal is distinct from platform-side legal (037).
