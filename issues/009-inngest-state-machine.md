# 009 — Inngest setup + order state machine

**Epic:** AI pipeline orchestration
**Type:** AFK
**Blocks:** 010, 012, 014, 020, 022, 024, 025, 026, 033
**Blocked by:** 001, 002
**PRD trace:** §9.2 (Inngest orchestration), §13.1 (state machine), §13.2 (failure recovery), §18.1 (full state diagram)

## Slice
The pipeline spine: Inngest wired, the order state machine modeled, transitions persisted, failures escalated. Steps land as stubs here; real work fills in via their own tickets.
- **Inngest:** client + `/api/inngest` handler; `npx inngest-cli dev` runs locally. `order.created` event triggers the pipeline function.
- **State machine (§18.1):** encode the states `payment_received → scraping → scrape_complete|scrape_failed(→docs_upload_fallback) → onboarding_in_progress → onboarding_complete → generating_copy → copy_review → copy_approved → compliance_review_layer2 → compliance_review_layer3 → building → deploying → deployed → email_sent → live → dns_monitoring`, plus failure states. Persist `orders.status` + `state_machine_position` on every transition; reject illegal transitions.
- **Steps as stubs:** one Inngest `step.run` per pipeline stage (scrape, intake, iapd, generation, validate, layer3, images, repo.create, build, repo.push, vercel.create, deploy, verify, email, dns.monitor) — each a no-op that advances state, with its own retry policy (§13.2: e.g. deploy x3 backoff, build x1, generation x1).
- **Failure escalation (§13.2):** failures beyond auto-retry write an `admin_alerts` row (`type:'order_failed'`) with the error trace → consumed by `/admin/orders` (033).
- **Verify path:** firing `order.created` advances a seeded order through the stub pipeline to a terminal state; forcing a step error creates an `admin_alerts` row.

## Acceptance
- [ ] Inngest dev server runs; `order.created` triggers the pipeline function.
- [ ] An order walks every §18.1 state in order; illegal transitions are rejected.
- [ ] Each transition persists `status` + `state_machine_position` on the `orders` row.
- [ ] Per-step retry policies match §13.2 (deploy x3 backoff, build x1, generation x1, scrape→fallback).
- [ ] A step failure beyond retry writes an `admin_alerts` row with an error trace.
- [ ] Rate-limit errors from 008 trigger Inngest backoff + retry (and a `state/rate-limits.md` log entry).

## Notes
- Vercel functions cap at 90–120s; all long work lives in Inngest steps, not API routes (§9.2). API routes only *enqueue*.
- Layer-3 (`compliance_review_layer3`) is a *state in the machine*, not out-of-band (CLAUDE.md) — first 50 sites + first 10 after a new ruleset + any Layer-2-flagged site (§5.2, §13.3).
- Keep step bodies thin here; real implementations replace the stubs in 012/014/020/022/024/025/026.
