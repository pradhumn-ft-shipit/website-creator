# Project Plan — WRI (Website for Regulatory Industries)

> Read first at the start of every session. Update at the end of every task.
> The plan is the collection of tickets in `issues/`. This file is the at-a-glance DAG + status.
> There are no phases — only "what is currently unblocked." Pick the lowest-ID unblocked ticket.

## Status: 008 Gemini client + 009 Inngest/state-machine DONE — AI chokepoint + pipeline spine both live

001–003, 00A, 027 (both slices), 008, 009 all committed (branch `foundation-001-003`). 008 & 009 were built
in parallel (isolated worktrees) and reconciled at integration on the rate-limit seam (see decisions.md).

Repo scaffolded; PRD read end-to-end; full 37-ticket v1 DAG defined and all `issues/NNN-*.md` files
written. Nothing committed yet (kept local by request). Next: review the DAG, then start **001**.

**HIL→AFK pass done 2026-05-31** (Q1–Q10, see `decisions.md`): 12 tickets reclassified to AFK,
6 stay light-HIL (sign-off / wireframe-checkpoint / external gate only — all *build* work is AFK).

## The DAG

Legend: `[AFK]` agent-completable · `[HIL]` human-in-loop · `[AFK build · gate]` build runs AFK, only a sign-off/checkpoint/external gate remains · `→ blocks` · `⊣ blocked by`

### Foundation (full tickets written)
- **00A** Platform design system & visual identity (warm Mercury/Ramp + emerald, light-first, balanced)
  `[HIL: direction sign-off on Slice-1 proof; rollout AFK]` ⊣ — · → re-touches 001/003/027, gates the *look*
  of all platform UI (028–037, 010, 013, 015, 021)
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

- **004** Email infra (Resend), **005** RIA ruleset, **011** Waitlist, **037** Platform legal — unblocked by 001.
- **008 done** unblocks **007** Prompt+eval harness (⊣ 001, 008 — now fully unblocked) and feeds 006/012/014/020/022.
- **009 done** unblocks **033** /admin/orders (⊣ 009, 002, 003 — now fully unblocked) and **010** Onboarding
  (⊣ 003, 009 — now unblocked, light wireframe checkpoint). Also a hard blocker cleared for 012/014/020/022/024/025/026.
- **Next best picks:** **033** (admin orders — consumes 009's `admin_alerts` escalation, most leverage),
  **007** (prompt+eval harness — pairs with 008), **010** (onboarding — first real order.created producer),
  or **005**/**004** (still standalone). **006** Layer-2 validator now needs only **005** (002+008 done).
- **003 done** unblocked: **027** Dashboard shell (✓ Slice 1 built), **033** /admin/orders (also 009),
  **010** Onboarding (also 009), **032** Billing (also 004, 025).
- **027 done (both slices)** — the dashboard shell + nav + Site Overview + Settings now exist, so **028**
  (Leads tab), **029** (Edit chat), **030** (Assets/Team), **031** (Blog), **032** (Billing) each have a
  shell to hang their tab on (each still gated by its own other blockers).
- 002 also directly unblocks 006, 014, 023, 028, 031 (per their `⊣` once their other blockers land).

## In progress
- _(nothing in flight)_

## Done
- **009 — Inngest setup + order state machine (PRD §9.2, §13.1, §13.2, §18.1).** The pipeline spine.
  **State machine** (`lib/orders/`): pure `transitions.ts` (ordered §18.1 states + legal transition table,
  incl. the `scrape_failed → docs_upload_fallback` branch) + `state-machine.ts` (`transitionOrder` persists
  `status` + `state_machine_position` on the `orders` row, `IllegalTransitionError` on any illegal hop) —
  pure core split from IO, same pattern as auth/account. **Inngest** (`lib/inngest/`): `client.ts` + serve
  route `/api/inngest`; `order.created` triggers `runPipeline`, which walks every stage as a thin `step.run`
  stub (scrape→intake→iapd→generation→validate→layer3→images→repo→build→deploy→verify→email→dns) advancing
  state, each with its §13.2 retry policy (`STEP_RETRY_POLICY`: deploy ×3 backoff, build ×1, generation ×1).
  **Failure escalation**: `handleStepFailure` → `escalateOrderFailure` writes an `admin_alerts` row
  (`type:'order_failed'` + trace) for `/admin/orders` (033). **008 seam**: `isRateLimitError()` catches a real
  `GeminiRateLimitError` (proven in `errors.test.ts` — imports both sides), logs to `state/rate-limits.md` via
  `appendRateLimitLog`, then rethrows so Inngest backs off + retries. **Layer-3 gating** centralized in
  `layer3Required({verdict, siteIndex})` (§5.2/§13.3) — currently first-50 OR Layer-2-flagged. Dep: `inngest
  ^3.54.2`. **No schema change** (002 already had `state_machine_position` + `admin_alerts`). **164 tests /
  typecheck / lint / build green** (incl. the 008⇄009 seam test). _Deferred (`[~]`): live `npx inngest-cli dev`
  round-trip + live DB writes (no infra/Docker this session, same as 001–003) — wiring build-verified;
  catch-up in decisions.md._ **Q4c still open:** flip `layer3Required` to flagged-only (one-function change).
- **008 — Gemini client wrapper + cost guard (PRD §8.1, §8.4, §8.2).** One deep module `src/lib/gemini/`
  — the single chokepoint every AI call goes through. **Model routing** (`models.ts resolveModel`): pro
  (generation) / flash (Layer-2 + edit chat) / flash-image (capped images) / pro+search (admin research),
  one interface, model picked per call. **`generateJSON(schema, …)`** (`client.ts`): parse + fenced-block
  extract + one repair pass, else `SchemaValidationError` — never free text. **Token budgets** (`budgets.ts`,
  §8.4): per-op input/output targets + hard caps (full-site 30k/12k cap 50k/20k; Layer-2 5k/1k cap 10k/2k;
  edit 1k/500 cap 3k/1.5k) → `TokenBudgetExceededError`, fail-loud, no silent truncation (§8.2.7). **Cost
  guard** (`cost.ts` `CostAccumulator`): per-site running USD total + <$2 guard → `CostBudgetExceededError`.
  **Typed errors** (`errors.ts`): `GeminiRateLimitError` is the **009 seam** — extends AppError, carries
  `isRateLimit:true` + `service:"gemini"` + `endpoint`(model) + `retryAfterMs?` so 009's duck-typed
  `isRateLimitError()` catches it and logs to `state/rate-limits.md` without importing the gemini tree
  (contract pinned in `errors.test.ts`; end-to-end proof in 009's inngest seam test). **Verify path**:
  dev-gated `GET /api/dev/gemini-check` returns a tiny structured object + token usage + estimated cost via
  the envelope. Dep added: `@google/genai ^2.7.0` (decisions.md). **126 tests / typecheck / lint / build green.**
  _Deferred (`[~]`): live calls / separate dev key (§9.3) — no key this session (same as 001–003); real SDK
  wired, `GEMINI_API_KEY` activates it, unit-tested against a mocked SDK boundary. Catch-up in decisions.md._
- **00A — Platform design system & visual identity.** Replaced the default-shadcn look (cold slate + generic
  indigo, flat) with the owner-chosen **warm trust-fintech (Mercury/Ramp) + emerald, light-first, balanced**
  direction. **Tokens** (`globals.css @theme`): warm stone neutrals, deep emerald `--primary` (AA-safe on
  white), warm-harmonized semantics, `--radius` 0.75rem, soft warm `--shadow-{xs,sm,card}`. **Type**: Fraunces
  display serif (headings, via `next/font`) + Hanken Grotesk body — ditched Inter-everywhere for a distinctive,
  premium pairing. **Primitives**: upgraded Button (emerald, rounded-lg, press/hover motion), Input
  (rounded-lg, emerald focus), Badge (re-derived AA tints) + a new shared **Card** primitive. **Rollout**:
  Settings (Slice-1 proof, owner-approved), dashboard shell + sidebar (emerald active pill) + Site Overview
  (→ `Card`) + loading/error/coming-soon (Slice 2), auth layout + login (Slice 3; landing/health inherit via
  tokens). Visual-QA: Settings `color-contrast` perfect + best-practices 100; **login a11y 100 / bp 100**;
  console clean; 390/1280px. 96 tests / typecheck / lint / build green. Temp preview routes (`preview-settings`,
  `preview-dashboard`) + dummy env + middleware allowance fully torn down. **Scope = platform only**; customer
  templates (016–019) keep their own design languages. Future platform tickets inherit the system via the
  tokens + primitives — no per-ticket design work.
- **027 (Slice 2) — Settings tab (PRD §12.9).** Migration `20260531150000_account_settings.sql` adds
  `accounts.full_name`, `lead_notification_frequency`, `system_alerts_enabled`, `deletion_requested_at`
  (existing `accounts_owner` RLS covers them — no policy change). Pure client-safe core
  `lib/account/settings.ts` (validators + 30-day `deletionState`, 12 unit tests) split from server IO
  `lib/account/service.ts` (the `next/headers` server client can't be imported by the client form — same
  pure/IO split as `auth/validation.ts` vs `auth/service.ts`). Email change → `auth/service.ts#changeEmail`
  (Supabase confirmation to the new inbox, neutral on already-in-use, no enumeration). Routes
  `/api/account/{profile,notifications,deletion}` (POST + DELETE for cancel) + `/api/auth/change-email`;
  password reuses `/api/auth/update-password`. UI: server `settings/page.tsx` (+ **read-only** domain card)
  + one client `SettingsForm` (profile / login-email / password / notifications radios+toggle / danger-zone
  with two-step confirm + grace-window "Keep my account"). Settings nav flipped `ready:true` (6 stubs left).
  96 tests green (18 new: 12 settings core + 3 changeEmail + nav/sidebar count updates + 6 settings-form
  frontend). typecheck/lint/build green. Visual-QA (chrome-devtools temp preview, fully torn down):
  best-practices **100**, a11y effectively 100 (only `landmark-one-main`, supplied by the shell's `<main>`
  in production), console clean, 375/1280px, two-step delete confirm verified live. **Domain settings =
  read-only status + DNS guidance** (the verification re-trigger needs the Vercel API → 025; no fake button).
  **Account purge job deferred** (needs Inngest 009 + a cron) — Slice 2 records deletion *intent* + grace
  window only. **Live Supabase read/write deferred** (no Docker — same as 001–003). **027 now fully Done.**

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
- Now unblocked & pickable: **004, 005, 007, 010, 011, 033, 037** (+ **006** once 005 lands). Still blocked:
  everything else — see `⊣ blocked by` above. (001, 002, 003, 027, 00A, 008, 009 done.)

## Notes / external prerequisites (PRD §17.5)
- GitHub App registration → needed for 024.
- Vercel team account + billing → needed for 025.
- Resend domain verification (SPF/DKIM/DMARC) → needed for 004 (prod sends).
- Stripe product/price setup → needed for 032.
- Legal review of ToS/Privacy/DPA/indemnification → gates 037 (before private beta).

## Open TBDs from the HIL→AFK pass (2026-05-31)
- **Second compliance approver (005)** — name a second reviewer before the ruleset publishes.
- **Flagged-site reviewer (034)** — name who works the Layer-3 queue.
- **009 follow-up (Q4c) — STILL OPEN.** 009 shipped `layer3Required({verdict, siteIndex})` implementing the
  original §5.2 "first-50 OR Layer-2-flagged" gate. To apply Q4c, change this one predicate to **flagged-only**
  (`verdict === 'fail'`) — centralized in `lib/inngest/pipeline.ts`, a one-function edit + test update.
