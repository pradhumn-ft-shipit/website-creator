# 034 — Admin: Layer-3 review queue + /admin/compliance/violations

**Epic:** Admin tooling
**Type:** AFK (queue UI; runtime review only on Layer-2-flagged sites — Q4c)
**Blocks:** —
**Blocked by:** 033, 006, 020
**PRD trace:** §5.2 (Layer 3), §5.8 (drift alerts), §11.3 (violations queue), §13.3 (manual gates)

## Slice
The human gate in the compliance engine — review sites before deploy and resolve flagged violations.
- **Layer-3 review (§5.2):** for orders in `compliance_review_layer3` (first 50 sites; first 10 after a new ruleset; any Layer-2-flagged site — §13.3), show generated copy + ruleset version + Layer-2 flags + intake summary. Actions: approve → continue pipeline; request regeneration with notes; manually edit before deploy.
- **Violations queue (§11.3):** list unresolved `compliance_violations`, sortable by severity/age/account; per row view violation + affected site + take action (approve fix / regenerate / manual edit / dismiss); bulk resolution.
- **Drift resolution (§5.8):** confirmed drift → "approve fix" email to customer (004) → AI regenerates → Layer 2 → deploy; never alarm without a paved path.
- **Verify path:** an order flagged by Layer 2 appears in the Layer-3 queue and can be approved/regenerated; a violation row resolves and records `resolution_action`.

## Acceptance
- [ ] Sites in `compliance_review_layer3` surface with copy + ruleset version + flags + intake.
- [ ] Reviewer can approve / regenerate-with-notes / manually-edit-before-deploy.
- [ ] Violations queue lists, sorts, and resolves with `resolution_action` recorded.
- [ ] Drift "approve fix" path regenerates → Layer 2 → deploys.
- [ ] Layer-3 engagement rules (first 50 / first 10 post-ruleset / any flagged) are honored.

## Notes
- Layer 3 is a *state in the machine* (CLAUDE.md), wired in 009 — this ticket builds its UI/actions.
- Customers never get scary out-of-compliance notices without a fix path (§5.8).

## Decision (2026-05-31)
- **Q4c — trust Layer 2 from launch.** The blanket pre-deploy gate (first 50 sites / first 10 after a new ruleset) is **removed**. Only **Layer-2-flagged sites** enter `compliance_review_layer3`; non-flagged sites auto-continue to deploy. The violations queue + drift resolution are unchanged.
- **Follow-up on 009:** the state-machine gating predicate that routes orders into `compliance_review_layer3` must change from "first-50 / first-10 / flagged" to "flagged only." If 009 is already built, schedule this as a one-line gating change.
- **Reviewer of flagged sites: TBD** — name who works the queue.
