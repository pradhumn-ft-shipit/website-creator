# 027 — Customer dashboard shell + Site Overview

**Epic:** Customer dashboard
**Type:** AFK (design autonomy via frontend-design skill + §7 — Q1c)
**Blocks:** 028, 029, 030, 031, 032
**Blocked by:** 003, 002
**PRD trace:** §12.1 (nav), §12.2 (site overview), §7.3/§7.6 (platform UX)

## Slice
The authenticated dashboard shell + the Site Overview landing tab.
- **Nav (§12.1):** Site Overview, Edit Site, Assets, Team, Leads, Blog, Billing, Settings (tabs stubbed where their ticket isn't done; no broken/half-built screens — §7.10).
- **Site Overview (§12.2):** Vercel-subdomain URL (always available), custom-domain status (Not configured / Pending / Verified), DNS instructions (inline or link), last deployed at, current template, "Visit live site".
- **Settings (§12.9) minimal:** email/password/profile, notification prefs, domain settings, account deletion (separate from cancellation; 30-day grace).
- **States:** empty/loading/error per §7.6.

## Acceptance
- [ ] Authenticated dashboard renders the §12.1 nav; unfinished tabs show a clean "coming soon" not a broken screen.
- [ ] Site Overview shows subdomain URL, domain status, last-deployed, template, visit-live.
- [ ] Domain status reflects `sites.custom_domain_verified_at` (Not configured/Pending/Verified).
- [ ] Settings supports email/password/profile + account deletion (30-day grace).
- [ ] Loading/empty/error states present per §7.6.

## Notes
- Load `skills/frontend-design.md`; platform feel ≈ Linear/Vercel/Stripe/Cal.com (§7.3, §7.13).
- Account deletion ≠ subscription cancellation (§12.9) — keep them distinct.
