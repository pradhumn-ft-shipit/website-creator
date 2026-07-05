# 004 — Email infrastructure (Resend) + email_log

**Epic:** Email
**Type:** AFK
**Blocks:** 024, 028, 032, 034
**Blocked by:** 001, 002
**PRD trace:** §9.4 (deliverability), §10.1 (`email_log`), CLAUDE.md (Resend fallback on bounce/complaint)

## Slice
A single deep `sendEmail()` module every later feature uses, with full audit logging.
- **Service:** Resend client wrapper exposing `sendEmail({template, to, data, replyTo?})`. From `noreply@wri.com`; supports per-send `Reply-To` (needed for lead notifications §4.5).
- **Templates:** React-email base layout + a registry keyed by template name (`verify_email`, `launch`, `lead`, `dns_success`, `cancellation_*`, `payment_failed`). Stub bodies acceptable; real copy lands with the consuming ticket.
- **Logging:** every send writes an `email_log` row with `resend_message_id` and `status`; a webhook (or status poll) updates `delivered|bounced|complained`.
- **Fallback (CLAUDE.md):** on bounce/complaint, log + surface (for `/admin/email-log` in 034); never blind-retry.
- **Verify path:** `POST /api/dev/send-test-email` (dev-gated) sends one email and writes the log row.

## Acceptance
- [x] `sendEmail()` sends via Resend and writes an `email_log` row with the Resend message ID.
      Proven against a mocked Resend boundary: `src/lib/email/client.test.ts`,
      `src/lib/email/log.test.ts`, `src/lib/email/send.test.ts`. `[~]` live send to a real
      Resend account (needs `RESEND_API_KEY`) not run this session — see live-domain flag below.
- [x] `Reply-To` override works (verified on the lead-style template).
      `EmailClient.send` forwards `replyTo` (`client.test.ts` "passes a per-send Reply-To
      override … (§4.5 lead notifications)"); `sendEmailWithDeps` forwards it end to end
      (`send.test.ts`).
- [x] Webhook/poll updates `email_log.status` to delivered/bounced/complained.
      `applyEmailStatusEvent` + `updateEmailLogStatus` (`webhook.test.ts`, `log.test.ts`);
      live-verified against `POST /api/webhooks/resend` (dev server, no-signature-secret path)
      — see decisions.md. `[~]` real Resend-delivered webhook call (needs a live domain +
      registered webhook) not run this session.
- [x] Bounce/complaint path logs without auto-retry.
      `updateEmailLogStatus`/`applyEmailStatusEvent` only ever write a status column — no send
      call exists on that path (`webhook.test.ts` "without ever calling sendEmail again").
- [x] Dev test endpoint sends + logs through the `{data,error}` envelope.
      `POST /api/dev/send-test-email` (dev-gated, 404 in prod); `route.test.ts` + live-verified
      (returns the opaque `{data:null,error:{code:"internal_error"}}` envelope with no
      `RESEND_API_KEY` configured, proving the envelope/gating wiring — see decisions.md).

## Notes
- External prerequisite (§17.5): Resend domain verification (SPF/DKIM/DMARC) before prod sends — works in dev sandbox meanwhile; note in README.
- Keep the template registry the only place email bodies live; callers pass data, not HTML.

## Live-domain flag (see decisions.md · 2026-07-05 · 004)
No live Resend domain/API key this session. Fully built + unit-tested against a mocked
`ResendBoundary`; gated behind `RESEND_API_KEY` (throws fast if unset, same posture as
008/012). Only fully verifiable once a Resend account + domain exist:
1. Set `RESEND_API_KEY` (sandbox key works pre-verification) → `POST /api/dev/send-test-email`
   → real message lands in the Resend sandbox + an `email_log` row appears.
2. Verify the domain (SPF/DKIM/DMARC) → send to a real recipient.
3. Register the Resend webhook at `/api/webhooks/resend`, set `RESEND_WEBHOOK_SECRET` →
   confirm a real delivery event flips `email_log.status` to `delivered`.
