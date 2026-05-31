# 033 — Admin: /admin/orders + state history + one-click retry

**Epic:** Admin tooling
**Type:** AFK (admin tooling, §7.10 low-fidelity-OK — Q6a)
**Blocks:** 034, 035, 036
**Blocked by:** 009, 002, 003
**PRD trace:** §11.1 (orders dashboard), §7.10 (admin UX), §13.2 (failure recovery), §10.1 (`admin_alerts`)

## Slice
The internal control room for builds — read the queue, inspect orders, retry failures.
- **Admin gate:** internal-only auth (WRI team); deny others.
- **Order list (§11.1):** Order ID, account (firm + email), created-at, current state (color-coded), time-in-state, last failure reason, actions (View / Retry / Manually intervene / Cancel). Filters by state ("needs review", "failed"), date range, account.
- **Detail view (§11.1):** full state-machine history, intake summary, generated-content preview, compliance violations, deployment logs, manual retry / step-through buttons.
- **Retry:** one-click re-trigger of the failed Inngest step (009); reads/clears `admin_alerts`.
- **UX (§7.10):** dense sortable tables fine here; every destructive action confirmed; no broken screens.

## Acceptance
- [ ] Non-admins are denied `/admin/*`.
- [ ] Order list shows all §11.1 columns + filters; state is color-coded.
- [ ] Detail view shows state history, intake, content preview, violations, deploy logs.
- [ ] One-click retry re-triggers the failed Inngest step and updates the order.
- [ ] List is driven by `admin_alerts`; destructive actions are confirmed.

## Notes
- `/admin/orders` is the primary support interface (§13.4) — most "tickets" are admins resolving failed orders.
- Admin tooling can be lower-fidelity but never broken (§7.10).
