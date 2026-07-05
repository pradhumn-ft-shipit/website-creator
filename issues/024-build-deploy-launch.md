# 024 — Build assembly + GitHub push + Vercel deploy + launch email + DNS monitor

**Epic:** AI pipeline orchestration
**Type:** AFK
**Blocks:** 029, 032
**Blocked by:** 016, 018, 020, 022, 004
**PRD trace:** §9.2 (build/assemble/repo/deploy steps), §9.5 (GitHub), §9.6 (Vercel + domain verify), §9.7 (MX check), §6.10/§7.11 (quality gate), §4.1 (steps 16–18), §13.2 (deploy retries), CLAUDE.md (archive-never-delete; GitHub/Vercel rate-limit fallback)

> **Consolidates former 024 + 025 + 026** — the whole "compliant content → live, verified site" tail of
> the pipeline. **Larger than the 12-file guardrail on purpose** (owner-approved): work it as the three
> sub-slices below, in order, each independently verifiable, rather than one monolithic push.

## Sub-slices (work in order — each is a checkpoint)

### A. Build assembly + GitHub (§9.2, §9.5) — blocks nothing until B
- **build.assemble (Inngest):** merge `sites.template_id` template + approved `generated_content` + `assets` (logos/photos/IAPD docs) + legal pages (022) → a complete Astro project; apply section-removal; write per-customer `tailwind.config.js` (brand colors).
- **Quality gate (§7.11):** run lighthouse + a11y (016 scripts) on the assembled build; **block push if any §6.10 threshold fails.**
- **repo.create + repo.push (§9.5):** via **GitHub App** (never PAT); repo `customer-{slug}-{shortid}`, private; commits tagged with the order/edit ID. Persist `sites.github_repo_url`. GitHub rate-limit → Inngest backoff + auto-resume, log to `state/rate-limits.md`.

### B. Vercel deploy + verify + DNS fetch + MX + launch email (§9.6, §9.7, §4.1.16–17)
- **vercel.project.create:** one project per site; env vars (`LEADS_ENDPOINT_URL`, `TURNSTILE_SITE_KEY`, `SITE_ID`).
- **vercel.deploy + vercel.verify:** trigger build hook; poll status; `deploy_failed` → retry ×3 backoff → admin queue (§13.2). Write `deployments` + `sites.vercel_project_id`/`vercel_default_url`.
- **DNS fetch (§9.6):** pull records via Vercel API for apex + www (auto-redirect to apex).
- **MX check (§9.7):** DNS lookup for MX on the custom domain; present → "your email will not be affected" callout **bold + red border**; absent → plain reassuring line.
- **Launch email (§4.1.17):** via 004 — Vercel-subdomain URL, DNS instructions, MX-aware callout, Cal.com link. Transition `deployed → email_sent → live`.

### C. DNS propagation monitor (§4.1.18, §9.6)
- **dns.monitor.start (Inngest cron):** every 6h for 7 days, verify the custom domain via the Vercel API.
- **On verified:** set `sites.custom_domain_verified_at`; send DNS-success email (004); stop the cron.
- **On 7-day timeout:** stop quietly; domain status stays "pending verification" in the dashboard (027).

## Acceptance
- [ ] Assembly produces a buildable Astro project from template + content + assets + legal pages; section-removal applied; per-customer `tailwind.config.js` carries brand colors.
- [ ] Lighthouse/a11y gate blocks push on any §6.10 threshold failure.
- [ ] Repo created via GitHub App (not PAT), private, `customer-{slug}-{shortid}`; commits tagged; `sites.github_repo_url` persisted; GitHub rate-limit backs off + auto-resumes + logs.
- [ ] Per-customer Vercel project created with the three env vars; deploy verified by polling; `deployments` + `sites` updated; deploy_failed retries ×3 then queues; Vercel rate-limit backs off + logs.
- [ ] DNS records fetched (apex + www, redirect to apex); MX present → emphasized callout, absent → plain line.
- [ ] Launch email sent via 004 (URL + DNS instructions + Cal.com link), logged in `email_log`.
- [ ] DNS monitor cron checks every 6h up to 7 days; verification stamps `custom_domain_verified_at` + sends success email; stops on success or after the window; dashboard (027) reflects status throughout.

## Notes
- External prerequisites (§17.5): GitHub App registration; Vercel team account + billing — both before prod.
- **Destructive guardrail (CLAUDE.md / §4.6):** customer repos are archived, never deleted (relevant to 032).
- Domain registration/management stays with the advisor's registrar — WRI only verifies (§3.2, §9.6).
- If a sub-slice's diff approaches the file guardrail, land A, then B, then C as separate commits — do not force one push.
