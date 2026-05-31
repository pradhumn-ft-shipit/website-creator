# 032 — Billing: Stripe subscription + cancellation flow + failed payment

**Epic:** Billing
**Type:** AFK (+ Q10b retention-offer scope)
**Blocks:** —
**Blocked by:** 003, 004, 025, 027
**PRD trace:** §4.6 (cancellation), §12.8 (billing tab), §15 (pricing/billing), CLAUDE.md (archive-never-delete)

## Slice
Real subscription billing + the lifecycle around cancellation and failed payments.
- **Subscription (§15):** Stripe customer + $50/mo subscription; persist `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `plan`. (Placeholder during alpha §15.4; full enforcement here, before private beta.)
- **Billing tab (§12.8):** embedded Stripe Customer Portal — plan, next billing date, payment method, invoices; cancel button.
- **Cancellation (§4.6):** confirm modal → cancel-at-period-end → `pending_cancellation`; warning emails (004) at day 0/14/28; at day 30 **delete the Vercel project, archive (not delete) the GitHub repo — kept 90 days**, set `cancelled`; reactivate within 90 days restores the site.
- **Failed payment (§15.3):** Stripe Smart Retries (3 over 7 days) → `past_due` + in-dashboard warning + email; after 14 days past_due → 30-day grace → offline + `cancelled`.
- **Webhooks:** Stripe events drive `subscription_status`.

## Acceptance
- [ ] Subscription create/manage works; status fields persist; webhooks update `subscription_status`.
- [ ] Billing tab shows portal (plan, next date, method, invoices) + cancel.
- [ ] Cancellation sets `pending_cancellation`, sends day 0/14/28 emails, and at day 30 deletes Vercel + archives GitHub (90-day) + sets `cancelled`.
- [ ] Reactivation within 90 days restores the site.
- [ ] Failed-payment path: retries → `past_due` → warnings → grace → offline.

## Notes
- **Destructive guardrail (CLAUDE.md / §4.6):** GitHub repos are archived for 90 days, never deleted. Vercel project is deleted (site goes offline) but source survives in the archived repo.
- External prerequisite (§17.5): Stripe account + product/price before private beta.

## Decision (2026-05-31)
- **Q10b — retention offer in cancel flow.** Before the cancel confirm commits, show a one-screen retention offer: **pause subscription (up to 3 months)** or a **discount coupon** (Stripe). Accepting applies the Stripe pause/coupon and aborts cancellation; declining proceeds to the §4.6 cancel-at-period-end path unchanged. Highest-ROI churn lever — keep it one screen. *Adds: a Stripe coupon/pause path + an acceptance check.*
