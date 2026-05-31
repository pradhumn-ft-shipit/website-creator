# 025 — Vercel deploy + verify + DNS fetch + launch email + MX check

**Epic:** AI pipeline orchestration
**Type:** AFK
**Blocks:** 026, 029, 032
**Blocked by:** 024, 004
**PRD trace:** §4.1 (steps 16–17), §9.6 (Vercel integration), §9.7 (MX check), §13.2 (deploy retries), CLAUDE.md (Vercel rate-limit fallback)

## Slice
Deploy the pushed repo to a per-customer Vercel project, verify it, and hand off DNS via the launch email.
- **vercel.project.create (§9.6):** one project per site; set env vars (`LEADS_ENDPOINT_URL`, `TURNSTILE_SITE_KEY`, `SITE_ID`).
- **vercel.deploy + vercel.verify:** trigger build hook; poll deployment status; `deploy_failed` → retry x3 backoff → admin queue (§13.2). Write `deployments` + `sites.vercel_project_id`/`vercel_default_url`.
- **DNS fetch (§9.6):** pull DNS records via Vercel API for apex + www (auto-redirect to apex).
- **MX check (§9.7):** DNS lookup for MX on the custom domain; if present, render the "your email will not be affected" callout **bold + red border**; else a plain reassuring line.
- **Launch email (§4.1.17):** via 004 — Vercel-subdomain URL, DNS instructions, MX-aware callout, Cal.com link. Transition → `deployed → email_sent → live`.
- **Verify path:** a pushed repo deploys, verifies, and a launch email is sent + logged; an MX-bearing domain produces the emphasized callout.

## Acceptance
- [ ] Per-customer Vercel project created with the three env vars.
- [ ] Deploy verified by polling; `deployments` + `sites` rows updated; deploy_failed retries x3 then queues.
- [ ] DNS records fetched (apex + www, redirect to apex).
- [ ] MX present → emphasized callout; absent → plain line (§9.7).
- [ ] Launch email sent via 004 with URL + DNS instructions + Cal.com link; logged in `email_log`.
- [ ] Vercel rate-limit backs off + retries + logs to `state/rate-limits.md`.

## Notes
- External prerequisite (§17.5): Vercel team account + billing before prod.
- Apex + www with auto-redirect to apex (§9.6).
