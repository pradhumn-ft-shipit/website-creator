# 028 — Lead capture API + leads dashboard tab

**Epic:** Lead capture
**Type:** AFK (Q1c design autonomy; + Q9b digest scope)
**Blocks:** 034
**Blocked by:** 002, 004, 027
**PRD trace:** §4.5 (lead flow), §6.4 (forms → WRI API), §12.6 (leads tab), CLAUDE.md (Turnstile)

## Slice
Receive contact-form submissions from generated sites into WRI, notify the advisor, and surface them.
- **API route (§4.5):** generated sites POST here (not to their repo). Server-side: Cloudflare Turnstile token check + honeypot empty + email-format valid. Write a `leads` row tagged with `site_id`.
- **Notification (§4.5):** Resend (004) email to the advisor with lead details; **`Reply-To` = lead's email** so Reply goes straight to the lead.
- **Leads tab (§12.6):** inbox list (name/email/phone/source page/received-at/status), view full message, mark viewed/archived, "Reply" opens mail client pre-filled, CSV export, unread count badge in nav.
- **Verify path:** a valid POST creates a lead + sends a Reply-To notification; a failed-Turnstile/honeypot POST is rejected.

## Acceptance
- [ ] Valid submission passes Turnstile + honeypot + email validation and writes a `leads` row.
- [ ] Advisor notification email has `Reply-To` set to the lead's email.
- [ ] Spam (bad Turnstile / filled honeypot) is rejected and not stored as a valid lead.
- [ ] Leads tab lists leads with status, view, mark viewed/archived, CSV export, unread badge.
- [ ] Lead data never lands in the customer's GitHub repo.

## Notes
- Per-customer `TURNSTILE_SITE_KEY` is set as a Vercel env var in 024 (deploy sub-slice B).
- WRI is data *processor* for lead PII (§14.6) — advisor is controller.

## Decision (2026-05-31)
- **Q1c** — leads-tab UX is AFK (design autonomy via frontend-design skill).
- **Q9b — instant + optional daily digest.** Keep instant per-lead email (default), and add an opt-in **daily-digest toggle** in Settings: when on, a scheduled Inngest job sends one daily summary of that day's leads in addition to the instant notifications. *Adds: a Settings pref + a scheduled job + an acceptance check for the digest.*
