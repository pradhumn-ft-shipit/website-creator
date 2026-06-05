# 011 — Waitlist capture (non-RIA industries)

**Epic:** Auth & onboarding
**Type:** AFK
**Blocks:** —
**Blocked by:** 001, 002
**PRD trace:** §2.2 (industry priority — "Coming soon, join waitlist"), §10.1 (`waitlist`)

## Slice
Email capture on the four non-RIA industry cards, feeding the build-second decision.
- **UI:** the four non-RIA cards (insurance, mortgage, law, real estate) show "Coming soon — join waitlist" with an email input + confirm.
- **Service:** writes a `waitlist` row (`email`, `industry`); idempotent on duplicate email+industry.
- **Confirmation:** inline success state; no account required.

## Acceptance
- [x] Each non-RIA card captures an email → `waitlist` row with the correct `industry`.
      (`industry-grid.tsx` inline `WaitlistCard` → `POST /api/waitlist` → `joinWaitlist`; `service.test.ts`.)
- [x] Duplicate email+industry does not create a second row.
      (Migration `20260605120000` adds `unique (email, industry)`; service upserts with `ignoreDuplicates`
      on normalized lowercase email — `service.test.ts` pins the upsert contract.)
- [x] Inline success + validation states per §7.6; works without auth.
      (Inline success swap in `WaitlistCard` + `flow.test.tsx`; API route is public, anon insert allowed by
      the `waitlist_public_insert` policy — `validate.test.ts` covers the validation states.)

## Done note (2026-06-05)
Built alongside **010** (the industry grid needs a functional waitlist). The four non-RIA cards expand an
inline email capture in place — no navigation, no account required. RLS migration adds the public-insert
policy the core-schema comment deferred here, plus the dedup index. Live DB insert deferred (no Docker, same
as 001–009); contract proven via the upsert-shape test + the unique index.

## Notes
- Standalone slice; can be built any time after 002. Often co-located with the 010 industry grid but tracked separately so it can ship independently.
- Waitlist counts inform industry #2 (§16.3: first vertical to cross ~200 signups).
