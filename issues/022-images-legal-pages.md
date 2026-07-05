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
- [x] Stock search resolves image slots before any AI generation; AI only triggers on stock miss; hard cap of 3/site enforced. _(slots.test.ts "resolves a slot with stock BEFORE ever generating AI" + "enforces the hard cap"; resolve.test.ts "fills every slot from stock and NEVER generates AI"; client.test.ts image-quota halt tests)_
- [x] No AI-generated people / hands-with-docs / client scenes — guarded in code, not just prompt. _(guard.test.ts 22 cases; ai.test.ts "REJECTS a prohibited-subject slot in code before calling Gemini" asserts the Gemini boundary is NEVER invoked)_
- [x] AI images stored as `ai_generated` assets with alt text; `STOCK_PHOTO_CREDITS.md` shipped. _(resolve.test.ts "stores AI images as ai_generated assets with alt text"; credits.test.ts; STOCK_CREDITS_FILENAME. Live Storage/asset-row write deferred behind Supabase — no Docker, same as 012/033)_
- [x] Privacy Policy generated per industry+state; covers contact-form collection; state-specific differences appear for state-registered fixtures. _(templates.test.ts "produces STATE-SPECIFIC copy: California surfaces CCPA/CPRA" + "names the state of registration"; Reg S-P + contact-form asserted)_
- [x] ToS/Disclaimer generated with the §14.1 limitations. _(templates.test.ts "includes the §14.1 informational-only + no-advice + limited-liability language")_
- [~] 404 matches the chosen template aesthetic. _(404 CONTENT object shipped — heading, back-home link, search prompt; the aesthetic RENDER is the template's job and lands with 016/018 + build 024. See decisions.md 022.)_
- [~] Legal pages wired as the footer's linked targets (with 016). _(Pages persisted at their canonical slugs `privacy` / `terms` / `not-found` for 024 to route; the footer link-up happens in 016, which is not yet built. See decisions.md 022.)_

## Notes
- **Hard stop (CLAUDE.md / §6.7):** AI-generated people are a compliance prohibition, not a style choice. Guard at the call boundary.
- Generated-site legal is distinct from platform-side legal (037).
