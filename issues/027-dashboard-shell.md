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
- [x] Authenticated dashboard renders the §12.1 nav; unfinished tabs show a clean "coming soon" not a broken screen. _Slice 1: `dashboard/layout.tsx` + `DashboardShell` (sidebar + mobile drawer) drive all 8 §12.1 tabs from `lib/dashboard/nav.ts`; the 7 not-yet-built tabs route to `StubTab` → `ComingSoon` (§7.10). Proven: `sidebar-nav.test.tsx` (8 tabs render, 7 "Soon", active via aria-current) + visual-QA (desktop sidebar + mobile drawer)._
- [x] Site Overview shows subdomain URL, domain status, last-deployed, template, visit-live. _Slice 1: `SiteOverviewView` renders all five from `buildSiteOverview`. Proven: `site-overview.test.tsx` + visual-QA (live + empty states). **Live Supabase read of the `sites` row deferred** (no Docker/Supabase this session — same constraint as 001–003); `getSiteOverview` is built and the derivation unit-tested._
- [x] Domain status reflects `sites.custom_domain_verified_at` (Not configured/Pending/Verified). _Slice 1: `deriveDomainStatus` — unit-tested for all three branches; rendered as a §7-contrast-AA badge. (Reads the live column once a site row exists — read path deferred per above.)_
- [x] Settings supports email/password/profile + account deletion (30-day grace). _**Slice 2 (this push).** Migration `20260531150000_account_settings.sql` adds `accounts.full_name`, `lead_notification_frequency`, `system_alerts_enabled`, `deletion_requested_at` (existing `accounts_owner` RLS already covers them). Pure core `lib/account/settings.ts` (validators + `deletionState` 30-day grace, 12 unit tests) + IO `lib/account/service.ts` (`getAccountSettings`/`updateProfile`/`updateNotificationPrefs`/`requestAccountDeletion`/`cancelAccountDeletion`). Email change via `lib/auth/service.ts#changeEmail` (Supabase confirmation, no enumeration). Routes: `/api/account/{profile,notifications,deletion}` + `/api/auth/change-email` (password reuses `/api/auth/update-password`). UI: server `settings/page.tsx` (+ read-only domain card) + one client `SettingsForm` (profile / email / password / notifications / danger-zone with two-step confirm + grace-window cancel). Settings nav flipped `ready:true`. Proven: `settings-form.test.tsx` (6 frontend tests) + `settings.test.ts` (12) + visual-QA (chrome-devtools temp preview, torn down): best-practices 100, a11y effectively 100 (only `landmark-one-main`, which the shell's `<main>` supplies in production), console clean, 375/1280px, two-step delete confirm verified. **Account purge job deferred** (needs Inngest 009 + cron); this records intent only. **Live Supabase read/write deferred** (no Docker — same constraint as 001–003)._
- [x] Loading/empty/error states present per §7.6. _Slice 1: `dashboard/loading.tsx` (skeleton), `dashboard/error.tsx` (human message + Try again), and the Site Overview not-live empty state. (Settings' own states land with Slice 2.)_

## Decision (2026-05-31)
- **Split into two vertical slices.** Slice 1 (this push): shell + nav + 7 coming-soon stubs + Site Overview + §7.6 states — the visible landing that unblocks 028–032, **zero schema change**. Slice 2: the full Settings surface (profile/email/password, notification prefs, domain settings, account deletion w/ 30-day grace), which needs its own migration. Driven by the >5-file guardrail + "split if it fills context." Settings stays a coming-soon stub until Slice 2.
- **Nav is one config (`lib/dashboard/nav.ts`).** Sidebar, mobile drawer, and per-tab headers all read it; `ready:false` tabs name the delivering ticket. Flipping a tab live = one boolean.
- **Account deletion scope (Slice 2):** request + 30-day grace + cancel only; the actual purge job is deferred (needs Inngest 009 + a cron), distinct from subscription cancellation (§12.9).
- **Slice 2 build (2026-05-31):** client/server split (`lib/account/settings.ts` pure core vs `lib/account/service.ts` IO) forced by the `next/headers` boundary; email change is an auth concern (`auth/service.ts#changeEmail`, Supabase confirmation, no enumeration); password reuses `/api/auth/update-password`; domain settings shipped **read-only** (re-verify needs Vercel API → 025); deletion records intent + grace only. No RLS change (4 new cols on `accounts`, covered by `accounts_owner`). See `state/decisions.md`.

## Notes
- Load `skills/frontend-design.md`; platform feel ≈ Linear/Vercel/Stripe/Cal.com (§7.3, §7.13).
- Account deletion ≠ subscription cancellation (§12.9) — keep them distinct.
