# 029 — Edit chat (post-launch) + compliance re-validation + redeploy

**Epic:** Customer dashboard
**Type:** AFK (Q1c design autonomy; + Q8b support-routing scope)
**Blocks:** —
**Blocked by:** 006, 020, 024, 025, 027
**PRD trace:** §4.4 (edit flow + allowed/not-allowed), §7.8 (edit chat UX), §8.5 (memory model), §12.3

## Slice
Let advisors change their live site via chat, with compliance re-checked on every change before deploy.
- **Chat UI (§7.8):** input fixed at bottom; each AI response = explanation + diff preview (side-by-side or red/green, never "trust me") + Approve/Reject/Refine; compliance status badge inline (✓ / ⚠ reason); edit-history tab with one-click revert + confirm.
- **Parse (§4.4, §8.5):** Gemini Flash (008) identifies affected pages/sections. Memory model: last 5 edits compressed (~200 tok) + current page copy (~500 tok) + ruleset + request; <1k tokens/edit; no rolling raw context.
- **Re-validation (§4.4):** Layer 2 (006) runs automatically; pass → "Approve and publish" creates a new `generated_content` version + `edits` row + triggers redeploy (024/025); fail → blocked with an AI-suggested compliant alternative.
- **Allowed vs not (§4.4):** allow copy/photo-swap/team/service/contact/page-toggle/section-reorder; **block** add-page, template switch, color/font, removing required pages, editing footer disclosures.
- **Verify path:** a compliant edit publishes + redeploys + logs an `edits` row; a "guarantee returns" edit is blocked with an alternative; a "remove disclosures" edit is refused.

## Acceptance
- [ ] Chat parses a request and shows a real before/after diff + inline compliance badge.
- [ ] Compliant edit → new `generated_content` version + `edits` row + redeploy.
- [ ] Non-compliant edit is blocked with an AI-suggested compliant alternative.
- [ ] Disallowed structural edits (add page, switch template, edit footer disclosures) are refused (§4.4).
- [ ] Edit history lists past edits; revert restores a prior version with confirmation.
- [ ] Per-edit context stays < 1k tokens (§8.5).

## Notes
- Footer disclosures are compliance-managed and not editable here (§4.4) — guardrail.
- Edits store the original `user_message` + `ai_reasoning` + `compliance_recheck_result` for audit (§10.1).

## Decision (2026-05-31)
- **Q1c** — edit-chat UX is AFK.
- **Q8b — block-but-route-to-support.** Disallowed structural edits (color/font, template switch, add-page, removing required pages, footer disclosures) are refused **with a support-routing path**, not a dead end: explain the change needs the WRI team and offer a one-click "contact support" that opens a support touch. Compliance-blocked *copy* edits still return an AI-suggested compliant alternative as before (§4.4).
