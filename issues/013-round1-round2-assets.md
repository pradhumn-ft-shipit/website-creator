# 013 — Round-1 confirm-or-correct + Round-2 questions + asset upload

**Epic:** Auth & onboarding
**Type:** human-in-loop (wireframe checkpoint before build — Q1c)
**Blocks:** 015, 020, 030
**Blocked by:** 012, 002
**PRD trace:** §4.1 (steps 8–12), §8.3 (two-round extraction), §6.8 (logo handling)

## Slice
The intake confirmation + the questions that can't be inferred, plus asset capture.
- **Round-1 confirm-or-correct (§8.3, §7.7):** show extracted fields (firm name, location, year founded, team size, services, ideal client, AUM, custodian, fee structure, designations, CRD) as "We think X — ✓ Yes / Edit", not blank fields. Writes corrections back to `intake_data`. AUM sets SEC vs state (§5.5).
- **Round-2 questions (§8.3):** differentiator, who-you-serve-best, one client story (to anonymize), photos pref, blog y/n, fees displayed y/n, logo background light/dark, custodian portal URL, office address.
- **Asset upload:** logo (+ §6.8 processing: variants, dominant color, wordmark fallback if none), team photos, office photos, docs → Supabase Storage + `assets` rows; team photos create `team_members` rows.
- **Quick questions (§4.1.8):** SEC/state, CRD, custodian, designations captured while scrape runs.

## Acceptance
- [ ] Round-1 fields render as confirm-or-correct; edits persist to `intake_data`.
- [ ] AUM ≥/< $100M sets `sub_industry` to `ria_sec`/`ria_state` and triggers state prompts (§5.5).
- [ ] All Round-2 questions captured; non-inferable ones are asked, never guessed.
- [ ] Logo upload produces sized variants + dominant color; no-logo path offers a wordmark preview.
- [ ] Uploaded assets create `assets` rows; team photos create `team_members` rows.

## Notes
- Confirm-or-correct (not fill-in-the-blanks) is a deliberate completion-rate choice (§8.3) — don't regress it.
- Load `skills/frontend-design.md`; §7.7 governs this flow.

## Decision (2026-05-31)
- **Q1c — wireframe checkpoint.** One wireframe approval for the confirm-or-correct + Round-2 + asset-upload flow, then AFK.
