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
- [ ] Round-1 fields render as confirm-or-correct; edits persist to `intake_data`.
- [ ] AUM ≥/< $100M sets `sub_industry` to `ria_sec`/`ria_state` and triggers state prompts (§5.5).
- [ ] All Round-2 questions captured; non-inferable ones are asked, never guessed.
- [ ] Logo upload produces sized variants + dominant color; no-logo path offers a wordmark preview.
- [ ] Uploaded assets create `assets` rows; team photos create `team_members` rows.
- [ ] Three templates render side-by-side with §6.1 descriptions; brand-color preview applied when colors were extracted, default otherwise.
- [ ] Selection persists to `sites.template_id`; exactly one site per account is created/updated.

## Notes
- Confirm-or-correct (not fill-in-the-blanks) is a deliberate completion-rate choice (§8.3) — don't regress it.
- Template previews must look polished — templates are the product (§7.4). Template switching after deploy is out of scope (§3.2).
- Load `skills/frontend-design.md`; §7.7 governs this flow.

## Decision (2026-05-31)
- **Q1c — wireframe checkpoint.** One wireframe approval for the confirm-or-correct + Round-2 + asset-upload + template-selection flow, then AFK.
