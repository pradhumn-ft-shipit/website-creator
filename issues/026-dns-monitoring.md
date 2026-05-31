# 026 — DNS propagation monitoring cron + success email

**Epic:** AI pipeline orchestration
**Type:** AFK
**Blocks:** —
**Blocked by:** 025
**PRD trace:** §4.1 (step 18), §9.6 (domain verification)

## Slice
After launch, watch the advisor's custom domain until DNS propagates, then confirm.
- **dns.monitor.start (Inngest cron):** every 6 hours for 7 days, verify the custom domain via the Vercel API.
- **On verified:** set `sites.custom_domain_verified_at`; send the DNS-success confirmation email (004); stop the cron.
- **On 7-day timeout:** stop quietly; domain status stays "pending verification" in the dashboard (027).
- **Verify path:** a fixture domain that verifies sends the success email + stamps `custom_domain_verified_at`; an unverified one stops after the window.

## Acceptance
- [ ] Cron checks the domain every 6h for up to 7 days.
- [ ] Verification stamps `custom_domain_verified_at` and sends the success email.
- [ ] Cron stops on success or after the 7-day window.
- [ ] Dashboard (027) reflects the domain status throughout.

## Notes
- Domain registration/management stays with the advisor's registrar — WRI only verifies (§3.2, §9.6).
