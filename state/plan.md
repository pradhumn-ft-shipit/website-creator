# Project Plan — WRI (Website for Regulatory Industries)

> Read first at the start of every session. Update at the end of every task.
> The plan is the collection of tickets in `issues/`. This file is the at-a-glance DAG + status.
> There are no phases — only "what is currently unblocked." Pick the lowest-ID unblocked ticket.

## Status: 027 Slice 1 done — dashboard shell + nav + Site Overview built (Settings = Slice 2, remaining)

001–003 committed (branch `foundation-001-003`); 027 Slice 1 in progress on the same branch.

Repo scaffolded; PRD read end-to-end; full 37-ticket v1 DAG defined and all `issues/NNN-*.md` files
written. Nothing committed yet (kept local by request). Next: review the DAG, then start **001**.

**HIL→AFK pass done 2026-05-31** (Q1–Q10, see `decisions.md`): 12 tickets reclassified to AFK,
6 stay light-HIL (sign-off / wireframe-checkpoint / external gate only — all *build* work is AFK).

## The DAG

Legend: `[AFK]` agent-completable · `[HIL]` human-in-loop · `[AFK build · gate]` build runs AFK, only a sign-off/checkpoint/external gate remains · `→ blocks` · `⊣ blocked by`

### Foundation (full tickets written)
- **001** Platform scaffold & `{data,error}` envelope `[AFK]` ⊣ — · → almost everything
- **002** Core DB schema + generated types (PRD §10) `[AFK]` ⊣ 001 · → most feature tickets
- **003** Auth: signup/login + email verification (§4.1, §4.7) `[AFK]` ⊣ 001, 002
- **004** Email infra (Resend) + `email_log` (§9.4) `[AFK]` ⊣ 001, 002
- **005** RIA v1.0 compliance ruleset + `lint:rulesets` (§5.3, §5.6, §18.2) `[AFK build · 2-person sign-off gate]` ⊣ 001
- **007** Prompt harness + eval harness (§8.2, §8.6) `[AFK]` ⊣ 001, 008
- **008** Gemini client wrapper + cost guard (§8.1, §8.4) `[AFK]` ⊣ 001
- **009** Inngest setup + order state machine (§9.2, §18.1) `[AFK]` ⊣ 001, 002

### Compliance engine (the moat — PRD §5)
- **006** Layer-2 validator + ruleset loader `[AFK]` ⊣ 002, 005, 008 · → 020, 021, 029, 031, 034

### AI pipeline (Inngest steps — §9.2, §18.1)
- **012** Scrape (Firecrawl) + intake.process + docs-upload fallback (§4.2, §4.3) `[AFK]` ⊣ 008, 009, 010
- **014** SEC IAPD auto-pull step (§5.4) `[AFK]` ⊣ 002, 009
- **020** Generation: full-site copy, Layer-1 → `generated_content` (§8) `[AFK]` ⊣ 006, 007, 008, 009, 012, 016
- **022** Image strategy: stock search + capped AI images (§6.7) `[AFK]` ⊣ 008, 009
- **023** Generated-site legal pages: privacy/ToS/404 (§6.9, §14.1) `[AFK]` ⊣ 002, 005
- **024** Build assembly + GitHub repo create/push (GitHub App) (§9.5) `[AFK]` ⊣ 016, 017, 018, 019, 020, 023, 009
- **025** Vercel deploy + verify + DNS fetch + launch email + MX check (§9.6, §9.7) `[AFK]` ⊣ 024, 004
- **026** DNS propagation monitor cron (7d) + success email (§4.1.18) `[AFK]` ⊣ 025

### Onboarding (§4.1, §7.7, §8.3)
- **010** Onboarding shell + industry/sub-class + payment placeholder + order create `[HIL: wireframe checkpoint]` ⊣ 003, 009
- **011** Waitlist capture (4 non-RIA industries) (§2.2) `[AFK]` ⊣ 001, 002
- **013** Round-1 confirm-or-correct + Round-2 questions + asset upload `[HIL: wireframe checkpoint]` ⊣ 012, 002
- **015** Template selection UI (§6.1) `[AFK]` ⊣ 013, 002

### Templates (Astro — §6, §7)
- **016** Shared component lib + content schema + sitemap.json + section-removal + footer (§6.2, §6.3) `[HIL: anchor sign-off]` ⊣ 005, 001
- **017** Trust template `[HIL: anchor sign-off]` ⊣ 016
- **018** Modern template `[AFK]` ⊣ 016, 017
- **019** Boutique template `[AFK]` ⊣ 016, 017

### Copy review (§4.1.13)
- **021** Copy preview + revision rounds (max 3) + final approval `[HIL: wireframe checkpoint]` ⊣ 020

### Customer dashboard (§12)
- **027** Dashboard shell + Site Overview `[AFK]` ⊣ 003, 002
- **028** Lead capture API (Turnstile/honeypot) + leads tab (§4.5) `[AFK]` ⊣ 002, 004, 027
- **029** Edit chat + compliance re-validation + redeploy (§4.4, §7.8, §8.5) `[AFK]` ⊣ 006, 020, 024, 025, 027
- **030** Assets + Team management tabs (§12.4, §12.5) `[AFK]` ⊣ 013, 014, 027
- **031** Blog upload + compliance check + publish (§5.9, §12.7) `[AFK]` ⊣ 006, 016, 027, 002
- **032** Billing: Stripe + cancellation flow + failed payment (§4.6, §15) `[AFK]` ⊣ 003, 004, 025, 027

### Admin tooling (§11)
- **033** `/admin/orders` + state history + one-click retry `[AFK]` ⊣ 009, 002, 003
- **034** Layer-3 review queue + `/admin/compliance/violations` (§5.2, §11.3) `[AFK]` ⊣ 033, 006, 020 · _Q4c: 009 gating → flagged-only_
- **035** `/admin/compliance` ruleset mgmt + research agent + publish + re-validate (§5.7) `[AFK]` ⊣ 006, 033
- **036** `/admin/leads` + `/admin/email-log` + `/admin/health` (§11.4–§11.5, §13.6) `[AFK]` ⊣ 033, 028, 004

### Platform legal (§14.2)
- **037** Platform ToS / Privacy / DPA `[AFK build · counsel gate]` ⊣ 001 (external: legal counsel before private beta)

## Unblocked right now

- **004** Email infra (Resend), **005** RIA ruleset, **008** Gemini client, **009** Inngest/state machine,
  **011** Waitlist, **037** Platform legal — all unblocked by 001. (007 still needs 008.)
- **003 done** unblocked: **027** Dashboard shell (✓ Slice 1 built), **033** /admin/orders (also 009),
  **010** Onboarding (also 009), **032** Billing (also 004, 025).
- **027 Slice 1 done** — the dashboard shell + nav now exist, so **028** (Leads tab), **029** (Edit chat),
  **030** (Assets/Team), **031** (Blog), **032** (Billing) each have a shell to hang their tab on (each still
  gated by its own other blockers). 027 **Slice 2 (Settings)** is itself a clean next pick (no new blockers).
- 002 also directly unblocks 006, 014, 023, 028, 031 (per their `⊣` once their other blockers land).

## In progress
- **027 — Customer dashboard shell + Site Overview.** **Slice 1 done** (this push). **Slice 2 remaining:**
  Settings tab — profile/email/password, notification prefs, domain settings, account deletion (30-day
  grace). Needs a migration (`accounts.deletion_requested_at` + notification-prefs column) + account
  service + routes. Until then the Settings tab shows the coming-soon placeholder.

## Done
- **027 (Slice 1) — Dashboard shell + nav + Site Overview (PRD §12.1, §12.2, §7.3/§7.6).** Auth-gated
  shell (`dashboard/layout.tsx` → `DashboardShell`: fixed desktop sidebar + mobile slide-over drawer +
  account footer). All 8 §12.1 tabs from one config (`lib/dashboard/nav.ts`, `activeNavKey` longest-prefix
  active match); the 7 not-yet-built tabs route to `StubTab`→`ComingSoon` (§7.10, names the delivering
  ticket). Site Overview (`SiteOverviewView` + `lib/dashboard/overview.ts`): live URL (verified custom
  domain → subdomain fallback), domain-status badge (`deriveDomainStatus`: not_configured/pending/verified
  ← `sites.custom_domain_verified_at`), last-deployed, template, "Visit live site", + designed not-live
  empty state. §7.6 states: `loading.tsx` skeleton + `error.tsx` (human message + Try again). Added
  `Badge` primitive (tinted variants darkened to clear WCAG AA on their washes). Sign-out button moved
  to `components/dashboard/`. **Zero schema change.** 75 tests green (24 new: nav + overview logic + nav
  + site-overview component tests); typecheck/lint/build green. Visual-QA (chrome-devtools, temp preview
  route, fully torn down): **Lighthouse a11y 100 / best-practices 100**, console clean, responsive
  375px + 1280px, mobile drawer verified. _Live Supabase read of `sites`/`accounts` deferred (no Docker
  this session — same constraint as 001–003); render proven via mock-data preview + component tests._

- **003 — Auth: signup/login + email verification (PRD §4.1, §4.7, §9.1).** Email/password + Google OAuth
  on Supabase Auth. New migration `*_auth_user_provisioning.sql`: `on_auth_user_created` AFTER INSERT
  trigger on `auth.users` mints the paired `public.users` + `public.accounts` rows (id == auth.uid(),
  the invariant 002's RLS relies on) for every signup path; a second trigger mirrors `email_confirmed_at`
  → `users.email_verified_at`. Service layer (`lib/auth/{validation,service,session}.ts`) maps Supabase
  errors → `AppError`, implements §4.7 duplicate detection (empty-identities → neutral dual-action message,
  no status disclosure) and verify-first/no-enumeration login. Route handlers via the envelope:
  `/api/auth/{signup,login,logout,reset-password,update-password}` (POST) + `/api/auth/callback` (GET,
  code/token_hash → session, covers OAuth + email confirm + recovery). `src/proxy.ts` (Next 16 renamed
  middleware) refreshes the session + guards routes (unauth → /login?next=…, authed-on-auth-page →
  /dashboard). UI: `(auth)` group — login / signup / check-email / reset-password / update-password +
  shared `components/auth/*` + shadcn input/label (native, no new dep) + `/dashboard` placeholder (→ 027).
  51 tests green (auth validation/service unit + login/signup frontend tests); typecheck/lint/build green.
  Visual-QA pass: Lighthouse a11y **100**, best-practices 100, console clean, responsive 375px/desktop,
  44px tap targets. _Deferred (no Supabase/Docker this session): live signup→verify→session round-trip,
  live Google OAuth, authenticated-route pass, live reset email — see decisions.md catch-up commands.
  Verification email uses Supabase's built-in sender until 004 swaps in Resend (seam in place). Not committed
  (kept local per convention)._
- **002 — Core DB schema + generated types (PRD §10).** Two Supabase migrations: `*_core_schema.sql`
  (all 17 §10.1 tables, PKs/FKs, enum-like `text`→CHECK columns incl. the full §18.1 order-status set,
  append-only triggers on `generated_content` + `compliance_rulesets`, assets replacement audit chain) +
  `*_rls_policies.sql` (RLS on all 17 tables; owner policies via `owns_account/order/site` SECURITY DEFINER
  helpers; internal/admin tables policy-less = deny-by-default). Service-role client (`lib/supabase/admin.ts`);
  hand-authored `database.types.ts` (mirrors migration; `gen:types` pending Docker) + `PUBLIC_TABLES`;
  `GET /api/health/db` row-count probe via the envelope; `supabase/seed.sql` user→account→order chain.
  19 tests green (getDbHealth unit + static schema-consistency), typecheck/lint/build green.
  _Deferred (Docker unavailable): `db push`, `gen:types`, live `/api/health/db` round-trip — see decisions.md
  for the exact catch-up commands. Not committed (kept local per convention)._
- **001 — Platform scaffold & `{data,error}` envelope.** Next.js 16 (App Router) + TS + Tailwind v4
  in `platform/`; central `apiHandler`/`AppError` envelope (`src/lib/api/envelope.ts`); Supabase
  server+browser clients; shadcn/ui (Button) + Lucide + §7.3 tokens (Inter, neutral+indigo+semantic,
  dark vars wired); `/api/health` + `/health` end-to-end proof; Vitest harness (9 tests) incl. the
  first frontend component test; `.env.example` + README. dev/build/lint/typecheck/test all green.
  _Not committed yet (kept local per prior convention). MCP visual-QA pass deferred — server not
  connected this session._
- Repo scaffold (git init, state/, issues/, compliance/ria/v1.0/, platform/, templates/, .gitignore).
- PRD read end-to-end; v1 DAG defined.

## Blocked
- Everything except 004, 005, 008, 009, 011, 037 (unblocked by 001) and 027 (unblocked by 002+003) —
  see `⊣ blocked by` above. (001, 002, 003 done.)

## Notes / external prerequisites (PRD §17.5)
- GitHub App registration → needed for 024.
- Vercel team account + billing → needed for 025.
- Resend domain verification (SPF/DKIM/DMARC) → needed for 004 (prod sends).
- Stripe product/price setup → needed for 032.
- Legal review of ToS/Privacy/DPA/indemnification → gates 037 (before private beta).

## Open TBDs from the HIL→AFK pass (2026-05-31)
- **Second compliance approver (005)** — name a second reviewer before the ruleset publishes.
- **Flagged-site reviewer (034)** — name who works the Layer-3 queue.
- **009 follow-up (Q4c)** — change the state-machine gating predicate routing orders into
  `compliance_review_layer3` from "first-50 / first-10 / flagged" to **flagged-only**.
