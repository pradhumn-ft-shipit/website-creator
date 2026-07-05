# 013 — Intake confirm-or-correct + Round-2 questions + asset upload + template selection

**Epic:** Auth & onboarding
**Type:** human-in-loop (one wireframe checkpoint before build — Q1c)
**Blocks:** 024, 030
**Blocked by:** 012, 002
**PRD trace:** §4.1 (steps 8–12 confirm/round-2, step 9 template pick), §8.3 (two-round extraction), §6.8 (logo handling), §6.1 (three templates)

> **Consolidates former 013 + 015.** The full advisor-facing intake flow from extracted-fields
> confirmation through template selection is one continuous UI slice; splitting the template pick
> into its own ticket only made sense under the old 5-file limit.

## Slice
The intake confirmation, the questions that can't be inferred, asset capture, and the template choice —
one guided flow off `structured_intake_json` (012).
- **Round-1 confirm-or-correct (§8.3, §7.7):** show extracted fields (firm name, location, year founded, team size, services, ideal client, AUM, custodian, fee structure, designations, CRD) as "We think X — ✓ Yes / Edit", not blank fields. Writes corrections back to `intake_data`. AUM sets SEC vs state (§5.5).
- **Round-2 questions (§8.3):** differentiator, who-you-serve-best, one client story (to anonymize), photos pref, blog y/n, fees displayed y/n, logo background light/dark, custodian portal URL, office address.
- **Quick questions (§4.1.8):** SEC/state, CRD, custodian, designations captured while scrape runs.
- **Asset upload:** logo (+ §6.8 processing: variants, dominant color, wordmark fallback if none), team photos, office photos, docs → Supabase Storage + `assets` rows; team photos create `team_members` rows.
- **Template selection (§4.1 step 9, §6.1):** Trust / Modern / Boutique shown side-by-side with their §6.1 descriptions + personas, each previewed with brand colors extracted in 012 when available (sensible default otherwise). Writes `sites.template_id` (`trust|modern|boutique`); exactly one site per account (v1). Selection is locked post-build (§3.2, enforced later by 029 edit-chat guardrails).

## Acceptance
- [x] Round-1 fields render as confirm-or-correct; edits persist to `intake_data`. — `intake-steps.tsx` ConfirmStep shows extracted `.value` per field (verified live in visual QA); `confirm.ts#saveRoundOneCorrections` upserts `structured_intake_json` (test: `confirm.test.ts` "merges corrections into the existing blob"; UI test: `intake-steps.test.tsx` "persists a correction").
- [x] AUM ≥/< $100M sets `sub_industry` to `ria_sec`/`ria_state` and triggers state prompts (§5.5). — `confirm.ts#deriveSubIndustry` + `saveQuickQuestions` (tests: `confirm.test.ts` deriveSubIndustry cases + "requires a primary state on the < $100M branch"); UI reveals the state select on the under-$100M branch (visual QA).
- [x] All Round-2 questions captured; non-inferable ones are asked, never guessed. — `RoundTwoStep` captures differentiator, serves-best, client story, photos pref, blog, fees, logo bg, portal URL, office address → `saveRoundTwo` (test: `confirm.test.ts` "stores round-2 answers under the roundTwo key").
- [~] Logo upload produces sized variants + dominant color; no-logo path offers a wordmark preview. — **Dominant color + wordmark fully met** (`assets.ts#processLogo`/`wordmarkFrom`, tests in `assets.test.ts`; wordmark preview verified live). **Sized-variant pixel resizing DEFERRED to 024** per 013 option-2 decision: this ticket computes the variant PLAN (favicon/header/social dims + roles) only; actual resizing happens at build (no `sharp` dep pulled in now).
- [x] Uploaded assets create `assets` rows; team photos create `team_members` rows. — `assets.ts#uploadAssetsForUser` (tests: `assets.test.ts` "creates a typed assets row" + "creates a team_members row … linked to the asset").
- [x] Three templates render side-by-side with §6.1 descriptions; brand-color preview applied when colors were extracted, default otherwise. — `TemplateStep` renders the 3 cards with §6.1 persona/aesthetic, tinted with extracted brand colour (`#1F6F52` banner verified live) or `previewAccentDefault` otherwise (`templates.test.ts` TEMPLATE_CATALOG).
- [x] Selection persists to `sites.template_id`; exactly one site per account is created/updated. — `templates.ts#selectTemplate` upserts by account (tests: `templates.test.ts` "inserts the first site" + "updates the existing site rather than creating a second").

## Notes
- Confirm-or-correct (not fill-in-the-blanks) is a deliberate completion-rate choice (§8.3) — don't regress it.
- Template previews must look polished — templates are the product (§7.4). Template switching after deploy is out of scope (§3.2).
- Load `skills/frontend-design.md`; §7.7 governs this flow.

## Decision (2026-05-31)
- **Q1c — wireframe checkpoint.** One wireframe approval for the confirm-or-correct + Round-2 + asset-upload + template-selection flow, then AFK.

## Build decisions (2026-07-05)
- **Wireframe approved**; template selection kept at the END of the flow (after brand colour + logo are settled), not PRD §4.1 step-9 order.
- **Logo option (2):** dominant colour + wordmark fallback done here; sized-variant resizing deferred to 024 (no `sharp`). Acceptance box 4 marked `[~]`.
- **Pipeline trigger moved off payment:** `checkout` now creates the order only; the `order.created` enqueue fires from `templates.ts#finalizeAndBuild` ("Build my site") after template selection.
- **Deferred (documented):** resume-refinement — a returning advisor mid-intake still resolves to the handoff screen because the order exists at checkout. Routing `payment_received` orders back into the intake flow needs `resolveResumeStep`/page.tsx to pass order status; deferred to keep each commit within the 12-file guardrail. Fresh straight-through flow works fully.
- **Backend curl-verify** needs local Supabase keys/Docker (env absent here) — routes are thin wrappers over unit-tested services; validated via `npm run build` (all routes compile) + service/UI tests. Visual QA done live via a throwaway preview harness (removed).
