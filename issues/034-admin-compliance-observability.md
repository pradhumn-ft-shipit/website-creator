# 034 — Admin: Layer-3 review queue + violations + observability (leads / email-log / health)

**Epic:** Admin tooling
**Type:** AFK (queue UI; runtime review only on Layer-2-flagged sites — Q4c)
**Blocks:** —
**Blocked by:** 006, 020, 028, 004, 033
**PRD trace:** §5.2 (Layer 3), §5.8 (drift alerts), §11.3 (violations queue), §11.4 (admin/leads), §11.5 (admin/email-log), §13.3 (manual gates), §13.6 (observability/health)

> **Consolidates former 034 + 036.** Both are admin-console tabs hung off 033's shell: the compliance
> action surfaces (Layer-3 review + violations + drift) and the read-only ops surfaces (leads / email-log
> / health). One ticket = "the rest of the admin console beyond orders (033) and ruleset authoring (035)."

## Slice

### Compliance action surfaces (§5.2, §11.3, §5.8)
- **Layer-3 review (§5.2, §13.3):** for orders in `compliance_review_layer3` (Q4c: **Layer-2-flagged sites only**), show generated copy + ruleset version + Layer-2 flags + intake summary. Actions: approve → continue pipeline; request regeneration with notes; manually edit before deploy.
- **Violations queue (§11.3):** list unresolved `compliance_violations`, sortable by severity/age/account; per row view violation + affected site + take action (approve fix / regenerate / manual edit / dismiss); bulk resolution; record `resolution_action`.
- **Drift resolution (§5.8):** confirmed drift → "approve fix" email to customer (004) → AI regenerates → Layer 2 → deploy; never alarm without a paved path.

### Read-only observability surfaces (§11.4, §11.5, §13.6)
- **/admin/leads (§11.4):** read-only view of all leads across all sites; for QA (notifications sending/delivered) + abuse detection (spam through Turnstile).
- **/admin/email-log (§11.5):** recent Resend sends with delivery status; filter by template / status / account; deliverability debugging.
- **/admin/health (§13.6):** queue depth, recent failures, deploy success rate (Inngest + Vercel + Supabase signals summarized).

## Acceptance
- [ ] Sites in `compliance_review_layer3` surface with copy + ruleset version + flags + intake; reviewer can approve / regenerate-with-notes / manually-edit-before-deploy.
- [ ] Violations queue lists, sorts, and resolves with `resolution_action` recorded.
- [ ] Drift "approve fix" path regenerates → Layer 2 → deploys.
- [ ] Layer-3 engagement honors Q4c (flagged-only; non-flagged auto-continue to deploy).
- [ ] `/admin/leads` lists all leads read-only with abuse-pattern visibility.
- [ ] `/admin/email-log` lists sends with status + filters (template/status/account).
- [ ] `/admin/health` shows queue depth, recent failures, deploy success rate.
- [ ] All surfaces are admin-gated; observability tabs are read-only (actions live in 033/034 compliance).

## Notes
- Layer 3 is a *state in the machine* (CLAUDE.md), wired in 009 — this ticket builds its UI/actions.
- Customers never get scary out-of-compliance notices without a fix path (§5.8).
- Read-only observability by design — lower fidelity OK, not broken (§7.10).

## Decision (2026-05-31)
- **Q4c — trust Layer 2 from launch.** The blanket pre-deploy gate (first 50 / first 10 after a new ruleset) is **removed**. Only **Layer-2-flagged sites** enter `compliance_review_layer3`; non-flagged auto-continue.
- **Follow-up on 009:** flip the gating predicate to "flagged only" (`verdict === 'fail'`) — a one-function change in `lib/inngest/pipeline.ts` (see plan.md open TBDs).
- **Reviewer of flagged sites: TBD** — name who works the queue.
