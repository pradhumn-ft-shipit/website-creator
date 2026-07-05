# 030 — Assets + Team management tabs

**Epic:** Customer dashboard
**Type:** human-in-loop (UX)
**Blocks:** —
**Blocked by:** 013, 014, 027
**PRD trace:** §7.9 (asset folder UX), §12.4 (assets), §12.5 (team)

## Slice
Post-launch management of assets and team members, flowing through the deploy pipeline.
- **Assets (§7.9, §12.4):** grid of cards (thumbnail, filename, "Used on:" badge, hover Replace/Remove); always-visible drag-drop upload with per-file progress; **two-step confirmation** modal on any change ("Update live now / Save for next batch / Cancel"); sections Logo / Team Photos / Office / Documents (ADV, CRS, Privacy) / Other; "Refresh ADV/CRS from SEC IAPD" button (calls 014).
- **Team (§12.5):** structured form per member (name, title, designations multi-select, bio + char count, photo, LinkedIn); drag-to-reorder (`order_index`); add/remove with confirmation. New team-photo upload triggers the structured form before appearing on site.
- **Pipeline:** changes flow through the same compliance + deploy path as edits (029 → 024).
- **Audit:** replacements set `assets.replaced_from_id`.

## Acceptance
- [ ] Asset grid shows where-used badges; replace/remove require the two-step confirmation.
- [ ] Upload supports drag-drop with per-file progress; replacements record `replaced_from_id`.
- [ ] "Refresh from SEC IAPD" re-pulls ADV/CRS via 014.
- [ ] Team CRUD works with reorder; new photo requires the structured form before publishing.
- [ ] Asset/team changes trigger compliance + redeploy.

## Notes
- Two-step confirmation is a §7.9/§12.4 requirement — don't allow silent replacement.
- Load `skills/frontend-design.md`.
