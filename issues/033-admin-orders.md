# 033 — Admin: /admin/orders + state history + one-click retry

**Epic:** Admin tooling
**Type:** AFK (admin tooling, §7.10 low-fidelity-OK — Q6a)
**Blocks:** 034, 035
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
- [x] Non-admins are denied `/admin/*`. _(env-allowlist gate: `requireAdmin` → unauth `/login`, non-admin `notFound()`; `assertAdmin` → 403 on `/api/admin/*`. `isAdminEmail` unit-tested.)_
- [x] Order list shows all §11.1 columns + filters; state is color-coded. _(7 columns incl. Account firm+email, Created, time-in-state, Last failure, Actions; filters by state-group/account/date; `stateTone` → color-coded Badge. Time-in-state is approximate until Slice 2's state-event history — accurate for failed rows, see decisions.md.)_
- [x] Detail view shows state history, intake, content preview, violations, deploy logs. _(**Slice 2**: `/admin/orders/[id]` renders full state-machine history (new `order_state_events` table, written by `transitionOrder` + the admin-retry reset), intake summary, generated-content versions, compliance violations, and deployment logs — plus Retry/Dismiss. Proven by `shapeOrderDetail`/`buildStateHistory` unit tests + the `order-detail.test.tsx` frontend test; visual-QA a11y 100 / bp 100. See decisions.md.)_
- [x] One-click retry re-triggers the failed Inngest step and updates the order. _(v1 resets the order → `payment_received`, bumps `retry_count`, resolves the alert, re-enqueues `order.created` to re-run the pipeline. Per-step **resume** (vs full restart) lands once 012–025 replace 009's stub steps — TODO in `orders.ts`.)_
- [x] List is driven by `admin_alerts`; destructive actions are confirmed. _(rows carry their unresolved `order_failed` alert; Retry + Dismiss both gated by an inline two-step confirm, verified live.)_

## Slices
- **Slice 1 (done):** admin gate + shell + `/admin/orders` list (columns, color-coding, filters) + Retry/Dismiss. Delivers the admin foundation 034–036 hang off.
- **Slice 2 (done):** order **detail view** — state-machine history (new `order_state_events` table written by `transitionOrder` + admin retry), intake summary, generated-content preview, compliance violations, deploy logs; row → detail link. **033 fully Done.**

## Notes
- `/admin/orders` is the primary support interface (§13.4) — most "tickets" are admins resolving failed orders.
- Admin tooling can be lower-fidelity but never broken (§7.10).
- "Manually intervene" / order-level "Cancel" → scoped to **Dismiss** (resolve the alert) in v1; subscription cancel is 032. (decisions.md)
