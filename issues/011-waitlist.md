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
- [ ] Each non-RIA card captures an email → `waitlist` row with the correct `industry`.
- [ ] Duplicate email+industry does not create a second row.
- [ ] Inline success + validation states per §7.6; works without auth.

## Notes
- Standalone slice; can be built any time after 002. Often co-located with the 010 industry grid but tracked separately so it can ship independently.
- Waitlist counts inform industry #2 (§16.3: first vertical to cross ~200 signups).
