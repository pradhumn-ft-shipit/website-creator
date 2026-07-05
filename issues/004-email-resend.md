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
- [ ] `sendEmail()` sends via Resend and writes an `email_log` row with the Resend message ID.
- [ ] `Reply-To` override works (verified on the lead-style template).
- [ ] Webhook/poll updates `email_log.status` to delivered/bounced/complained.
- [ ] Bounce/complaint path logs without auto-retry.
- [ ] Dev test endpoint sends + logs through the `{data,error}` envelope.

## Notes
- External prerequisite (§17.5): Resend domain verification (SPF/DKIM/DMARC) before prod sends — works in dev sandbox meanwhile; note in README.
- Keep the template registry the only place email bodies live; callers pass data, not HTML.
