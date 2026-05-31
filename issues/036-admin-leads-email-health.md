# 036 — Admin: /admin/leads + /admin/email-log + /admin/health

**Epic:** Admin tooling
**Type:** AFK
**Blocks:** —
**Blocked by:** 033, 028, 004
**PRD trace:** §11.4 (admin/leads), §11.5 (admin/email-log), §13.6 (observability/health)

## Slice
Internal read-only observability surfaces for QA, deliverability, and system health.
- **/admin/leads (§11.4):** read-only view of all leads across all sites; for QA (notifications sending/delivered) + abuse detection (spam through Turnstile).
- **/admin/email-log (§11.5):** recent Resend sends with delivery status; filter by template, status, account; critical for deliverability debugging.
- **/admin/health (§13.6):** queue depth, recent failures, deploy success rate (Inngest + Vercel + Supabase signals summarized).
- **Verify path:** leads/email-log render real rows with filters; health shows current queue depth + recent failures.

## Acceptance
- [ ] `/admin/leads` lists all leads read-only with abuse-pattern visibility.
- [ ] `/admin/email-log` lists sends with status + filters (template/status/account).
- [ ] `/admin/health` shows queue depth, recent failures, deploy success rate.
- [ ] All three are admin-gated and read-only.

## Notes
- Read-only by design — actions live in 033/034. Lower fidelity OK, not broken (§7.10).
