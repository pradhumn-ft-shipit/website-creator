# 010 — Onboarding shell + industry/sub-class + payment placeholder + order create

**Epic:** Auth & onboarding
**Type:** human-in-loop (wireframe checkpoint before build — Q1c)
**Blocks:** 012, 013, 020
**Blocked by:** 003, 009
**PRD trace:** §4.1 (steps 4–6), §7.7 (onboarding UX), §15.4 (payment placeholder for alpha)

## Slice
The conversational onboarding spine that creates an order and kicks off the pipeline.
- **Shell (§7.7):** one-question-at-a-time, top progress indicator, Back/Next, auto-save every step, "save & continue later" via magic link, skip-with-default on non-required questions; under-10-min target.
- **Industry selection (§2.2):** five-card grid; RIA clickable; other four show "Coming soon — join waitlist" → hand off to 011.
- **Sub-classification:** RIA-only (SEC vs state resolved later from AUM, §5.5).
- **Payment placeholder (§15.4):** Stripe-hosted $50/mo checkout, live but not enforced in alpha; on "success" create the `orders` row and emit `order.created` (→ 009).
- **Background status:** non-blocking indicator surfaces scrape/generation progress at top of screen.

## Acceptance
- [x] One-question-at-a-time flow with progress, Back/Next, and auto-save (refresh loses nothing).
      (ProgressRail + BackButton; each step POSTs to `/api/onboarding/selection` before advancing, so
      the server page re-derives the resume step from the persisted account on refresh — `flow.test.tsx`
      + `steps.test.ts#resolveResumeStep`.)
- [x] Industry grid: RIA proceeds; the other four route to waitlist capture (011).
      (`industry-grid.tsx` + `flow.test.tsx` waitlist-branch test.)
- [x] Completing checkout (placeholder) creates an `orders` row and fires `order.created`.
      (`createOrderAndEnqueue` → insert `payment_received` + emit; `service.test.ts` + `flow.test.tsx`.)
- [~] "Save & continue later" resumes via emailed magic link from any step.
      (Resume works fully — every step auto-saves and the server resolves the resume step, so an
      already-signed-in advisor returns to `/onboarding` and lands exactly where they left off. The
      *emailed* magic-link delivery of that resume URL is deferred to **004** (Resend), same seam 003 used.)
- [~] Non-required questions support skip-with-default; required ones block.
      (Industry + payment are required and block; the sub-class step defaults to `ria_only`. None of 010's
      three steps is a genuinely-optional question, so the skip-with-default *affordance* first appears with
      **013**'s optional quick-questions — `validateSubClass` + the save-before-advance mechanism are in place.)
- [x] Background-processing indicator renders without blocking the flow.
      (Handoff screen's `aria-live` "Preparing your website…" indicator — non-blocking, advisor can leave.)

## Notes
- Load `skills/frontend-design.md` before building screens; §7 is mandatory.
- Payment is a deliberate placeholder in alpha (§15.4) — full Stripe enforcement is 032, required before private beta.
- This is the first slice that reaches the UI for the build pipeline — keep it thin but end-to-end.

## Decision (2026-05-31)
- **Q1c — wireframe checkpoint.** Onboarding drives signup completion, so the build pauses once for a one-screen text/ASCII wireframe of the flow; on approval the rest is AFK. Logic, auto-save, payment placeholder, and order-create need no mid-build input.
