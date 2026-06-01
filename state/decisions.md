# Decisions Log

Append-only. One entry per non-obvious architectural choice. Format: date · context · choice · why.

---

## 2026-05-31 · Repo scaffold + stack lock-in

**Context:** First setup pass on the WRI repo. CLAUDE.md already pins the stack and conventions;
recording them here so the decisions log is the single queryable source.

**Choice — Stack (locked):**
- Platform: Next.js (App Router) + TypeScript on Vercel
- Database + Auth + Storage: Supabase (Postgres + Auth + Storage)
- Background jobs: Inngest (long pipeline work; Vercel functions cap at 90–120s)
- Email: Resend · Scraping: Firecrawl
- UI: shadcn/ui (Radix + Tailwind), copy-into-codebase · Icons: Lucide
- AI: Gemini 2.5 Pro (generation), 2.5 Flash (validation + edit chat), 2.5 Flash Image (capped)
- Customer sites: Astro + Tailwind, one GitHub repo + one Vercel project per customer
- Customer GitHub access via GitHub App (never PAT); Vercel deploys via Vercel API per project
- Payment: Stripe (subscription; placeholder during alpha) · Spam: Cloudflare Turnstile

**Why:** Carried verbatim from CLAUDE.md "Stack (locked)". Supabase consolidates DB+Auth+Storage
to reduce moving parts. Inngest because the scrape→generate→build→deploy pipeline exceeds Vercel's
function timeout. shadcn single-library to keep one quality standard across both product surfaces.

**Choice — Conventions:**
- API responses use the `{data,error}` envelope, enforced centrally; raise `AppError` for expected failures.
- Schema source of truth = Supabase migrations (tests build schema from migrations).
- Compliance rulesets are versioned repo artifacts under `compliance/{industry}/v{version}/`,
  not DB rows; the DB only records which ruleset version a site was built against.

**Choice — Conventions (cont.):** API responses use the `{data,error}` envelope, enforced centrally;
schema source of truth = Supabase migrations; compliance rulesets are versioned repo artifacts under
`compliance/{industry}/v{version}/`, DB only records the version a site was built against.

---

## 2026-05-31 · Ticket DAG planned from full PRD

**Context:** PRD (`WRI_PRD_v1.0.md`, 1618 lines) read end-to-end and converted to a vertical-slice
kanban DAG. (Correction: an earlier pass in this session wrongly assumed the PRD was empty — it was
not; it is fully populated. No planning was deferred.)

**Choice — 37-ticket v1 DAG.** See `state/plan.md` for the full DAG. Shape:
- **Foundation wave (full tickets written first):** 001 scaffold, 002 core schema, 003 auth,
  004 email/Resend, 005 RIA compliance ruleset, 007 prompt+eval harness, 008 Gemini client,
  009 Inngest + order state machine. These are the unblocked / one-hop spine.
- **Pipeline (Inngest steps, PRD §9.2 / §18.1):** scrape+intake (012), IAPD (014), generation (020),
  Layer-2 validate (006), images (022), assembly+GitHub (024), Vercel deploy (025), DNS monitor (026).
- **Onboarding (PRD §4.1, §7.7, §8.3):** 010 shell+payment, 011 waitlist, 013 confirm-or-correct +
  R2 + assets, 015 template select, 021 copy review/revisions.
- **Templates (PRD §6, §7):** 016 shared lib + sitemap + section-removal, 017/018/019 Trust/Modern/Boutique.
- **Dashboard (PRD §12):** 027 shell+overview, 028 leads, 029 edit chat, 030 assets+team, 031 blog, 032 billing.
- **Admin (PRD §11):** 033 orders+retry, 034 Layer-3 + violations, 035 ruleset mgmt + research agent,
  036 leads/email-log/health.
- **Legal (PRD §14):** 023 generated-site legal, 037 platform ToS/Privacy/DPA.

**Why this shape:** Compliance is the moat (CLAUDE.md), so the ruleset (005) + Layer-2 validator (006)
are early and block all copy-producing tickets. The Inngest pipeline is the spine of the product loop
(PRD §9.2); each step is its own ticket with its own retry policy. Onboarding's first slice reaches the
UI (010) before generation. Templates are split one-per-aesthetic because each is "fully designed, not a
starting point" (PRD §7.4) and is human-in-loop design work.

**Choice — Schema laid down as a core spine migration (002), not per-feature.** The PRD §10 data model
is fully specified upfront and ~15 tables are shared across many parallel tickets. A single spine
migration avoids cross-ticket migration churn. Mild deviation from pure vertical-slicing, accepted
because the schema is settled in the PRD. Feature tickets may add feature-local columns/tables as needed.

**Open / external-input items flagged in tickets (PRD §17.5):** GitHub App registration, Vercel team
account, Resend domain (SPF/DKIM/DMARC), Stripe product setup, and legal review of ToS/Privacy/DPA/
indemnification are human-in-loop prerequisites, marked on tickets 024, 025, 004, 032, 037 respectively.

---

## 2026-05-31 · HIL → AFK pass (Q1–Q10 answered)

**Context:** 18 tickets were tagged `human-in-loop`. Reviewed each; almost none needed human input to
*build* — the HIL was design taste, a runtime human gate, or an external/legal gate. Front-loaded 10
decisions so most can run AFK. Also added a CLAUDE.md rule: questions must state business impact, not
just tech (the point of each question is to make a ticket AFK-able).

**Answers:**
- **Q1 = c (design autonomy, hybrid).** Internal/dashboard screens go AFK via `frontend-design` skill +
  §7; **010, 013, 021** keep a single wireframe checkpoint (they drive signup completion). → 015, 027,
  028, 029, 030, 031 AFK; 010/013/021 light-HIL.
- **Q2 = b (anchor first).** 016 + 017 (Trust) get a one-time quality-bar sign-off; 018/019 inherit AFK.
- **Q3 = a (ruleset authoring AFK).** Agent drafts full `ria/v1.0` with citations; two-person sign-off
  before publish stays (legal hard stop, §5.7). **Second approver: TBD** (external counsel before public launch).
- **Q4 = c (trust Layer 2 from launch).** Removes the blanket first-50 / first-10-post-ruleset pre-deploy
  gate; **only Layer-2-flagged sites** enter `compliance_review_layer3`. → **009 follow-up:** change the
  gating predicate to "flagged only." **Flagged-site reviewer: TBD.**
- **Q5 = a (legal drafts now).** Generate ToS/Privacy/DPA (Termly-style + §14.3 indemnification) AFK;
  external counsel review before private beta stays a prerequisite, not mid-build input.
- **Q6 = a.** Reclassify 033 (/admin/orders) and 035 (/admin/compliance) to AFK — their "human" parts are
  runtime features, not build input; §7.10 allows lower-fidelity admin UI.
- **Q7 = b.** Blog at-limit = interest-capture prompt (log demand for a future tier), not an upsell to a
  nonexistent plan. (031)
- **Q8 = b.** Edit-chat blocked edits = block-but-route-to-support, not a dead-end refusal. (029) — adds scope.
- **Q9 = b.** Lead notifications = instant per lead **+** optional daily-digest toggle in Settings. (028) — adds scope.
- **Q10 = b.** Cancellation gets a one-screen pause/discount retention offer before commit. (032) — adds scope.

**Resulting status:** 12 tickets → AFK (015, 018, 019, 027, 028, 029, 031, 032, 033, 034, 035, 037);
6 stay light-HIL (005 sign-off gate; 010, 013, 021 wireframe checkpoint; 016, 017 anchor sign-off).
All *build* work is AFK across the board — remaining HIL is sign-off/checkpoint/external-gate only.

**Open TBDs to resolve before the relevant ticket publishes/deploys:** second ruleset approver (005),
flagged-site reviewer (034). Scope added to 028/029/031/032 (digest job, support routing, interest
capture, retention offer) — reflected in each ticket's `## Decision (2026-05-31)` block.

---

## 2026-05-31 · Front-end visual feedback loop — `chrome-devtools` MCP

**Context:** AI agents lack the visual feedback loop human front-end devs rely on (look at the
rendered UI, iterate). Evaluated two candidates dropped in `info-for front-end sikll/`:
`chrome-devtools-mcp` (Google) and `dev-browser` (Sawyer Hood). Separately, CLAUDE.md build loop
step 8 already requires *committed* frontend tests wired into `npm test` — a different need.

**Choice:** Adopt **`chrome-devtools-mcp` only** as the ad-hoc visual QA loop. Registered in
`.mcp.json` as server `chrome-devtools`, run via `npx chrome-devtools-mcp@1.1.1 --headless --isolated`
(launches its own headless Chrome — no remote-debugging-port / manual Chrome launch). Usage codified
in `skills/frontend-visual-qa.md`. Build loop step 8 split into (a) visual QA loop + (b) committed
test/preview-URL handoff — both required.

**Why:**
- This project's hard requirements (Lighthouse §6.10, WCAG 2.1 AA §7, dark-mode, performance traces,
  network/console inspection) map directly to chrome-devtools-mcp's native tools (`lighthouse_audit`,
  a11y `take_snapshot`, `emulate` colorScheme, `performance_*`). `dev-browser` is leaner/cheaper but
  lacks exactly those (no dark-mode emulation, no viewport control, no Lighthouse, no perf traces) —
  so its cost edge doesn't pay off here.
- Self-launching headless Chrome = lowest setup friction; nothing to start by hand.
- Context-heaviness (the known downside) mitigated by: prefer `take_snapshot` over `take_screenshot`,
  `filePath` for large blobs, filter/paginate network+console, `--isolated` clean profile per session.

**Explicitly NOT replaced:** the committed automated frontend test (Playwright test / Vitest browser
mode in `npm test`). The MCP browser is the agent's QA loop; it leaves nothing the user can re-run.
Stand up the Playwright/Vitest harness on the first UI ticket (per the dependency guardrail).

**Version pin:** `chrome-devtools-mcp@1.1.1` — bump deliberately. Requires Node ≥20.19; Chrome auto-
provisioned by Puppeteer.

---

## 2026-05-31 — Ticket 001: Platform scaffold conventions

**Context:** First ticket. `create-next-app@latest` pulled **Next.js 16.2.6 + React 19 + Tailwind v4**
(newer than expected). These versions ripple through every later ticket, so the choices below are the
defaults all platform work inherits.

**Choices:**
- **Stack as-shipped:** Next 16 (App Router, Turbopack build) + React 19 + Tailwind v4 + TS strict.
  `src/` dir, `@/*` → `src/*`. Removed generator boilerplate (`platform/CLAUDE.md`, `AGENTS.md`,
  default SVGs) — root `CLAUDE.md` is the only agent-instruction file.
- **API envelope = one deep module** (`src/lib/api/envelope.ts`): `apiHandler(fn)` wraps every route;
  returns `{data,error:null}` on a returned payload, `{data:null,error:{message,code}}` on a thrown
  `AppError` (with its `status`), and an **opaque 500** (`code:"internal_error"`, generic message,
  server-side `console.error`) on any other throw — raw errors never leak. A returned `NextResponse`
  passes through untouched (for redirects/custom headers). Routes never hand-build the envelope.
- **shadcn/ui set up manually** (copy-into-codebase), NOT via the CLI — the shadcn CLI's framework
  detection is unreliable on Next 16. `components.json` + `src/lib/utils.ts` (`cn`) + `src/components/ui/button.tsx`
  written by hand so `npx shadcn@latest add <x>` still works going forward. Single library only.
- **§7.3 design tokens** in `globals.css` as shadcn-named CSS variables (oklch): neutral grayscale +
  **indigo** brand accent + semantic (success/warning/destructive). **Dark-mode variables are wired
  now** (`.dark` + `@custom-variant dark`) though v1 ships light-only (PRD: dark optional v1, expected
  v1.5) — flipping it on is a one-line `dark` class later.
- **Inter for the platform** (ticket + PRD §7.3 mandate it). The frontend-design skill's "avoid Inter"
  rule applies to the **generated customer sites** (distinctiveness), not the platform chrome.
- **Live-data UI pattern (precedent for all UI tickets):** Server Component fetches the initial value
  from a shared source-of-truth function; Client Component takes it as a prop and only fetches on user
  interaction. Chosen over fetch-in-`useEffect` because React 19's `react-hooks/set-state-in-effect`
  lint rule flags setState-on-mount — and we'd rather set a clean pattern than suppress the rule on the
  foundational ticket. See `src/lib/health.ts` + `/health`.
- **Test harness = Vitest + jsdom + Testing Library** (`@vitejs/plugin-react`), `npm test` = `vitest run`.
  Component/UI tests live next to code as `*.test.tsx`; this is the committed frontend-test harness
  required by build-loop §8b. (No Playwright yet — Vitest browser-mode/Testing Library covers v1 UI
  tests; revisit if true e2e is needed.)
- **`gen:types`** wired to `supabase gen types typescript --local`; `src/types/database.types.ts` is a
  placeholder until 002 lands the schema.

**Deferred:** build-loop §8a (chrome-devtools MCP visual QA) — the `chrome-devtools` MCP server is not
connected in this session, so the headless-Chrome pass (dark mode / responsive / Lighthouse / a11y)
did not run. Routes were verified via live-server curl instead. Run the MCP pass before final sign-off
in a session where it's connected.

**Not committed:** code kept local, consistent with the prior "kept local by request" convention. No
git commit made for 001.

---

## 2026-05-31 — Ticket 002: Core DB schema + types

**Context:** Laid down the PRD §10.1 v1 schema spine as Supabase migrations. Docker/local Postgres is
**not available in this session**, so `supabase db push`, `db reset`, and `gen:types` (all of which need
a running local Postgres) could not be executed — same environment constraint that deferred 001's MCP pass.

**Choices:**
- **Two migrations, not one.** `*_core_schema.sql` (all 17 tables) + `*_rls_policies.sql` (RLS). Splitting
  keeps the table DDL readable and lets RLS hardening (deferred to v1.1, §10.3) evolve in its own file.
- **Enum-like `text` columns → CHECK constraints**, not Postgres `enum` types. The PRD specifies these as
  `text` with comment-listed value sets; CHECK enforces the closed set while staying ALTER-friendly (new
  states don't need an `ALTER TYPE`). `orders.status` carries the full §18.1 state set as a CHECK; the
  state-machine *transitions* remain ticket 009's job — 002 only constrains the column's domain.
- **Non-destructive-update enforced in the DB, not by convention.** `generated_content` and
  `compliance_rulesets` get `before update` trigger guards: generated_content allows only approval columns
  (`approved_at/by`) to change; rulesets allow only lifecycle columns (`published_at/by`, `retired_at`).
  Any content edit raises `check_violation`. This makes "no destructive-update path exists" (acceptance +
  §10.2) a hard guarantee — new content = new version row.
- **RLS: deny-by-default + owner policies via SECURITY DEFINER helpers** (`owns_account/owns_order/owns_site`).
  User-facing tables get one `FOR ALL` owner policy each; internal/admin tables (compliance_rulesets,
  compliance_violations, admin_alerts, email_log, waitlist) get RLS enabled with **no policy** — reachable
  only by the service-role key. Ownership assumes `public.users.id == auth.uid()` (standard Supabase
  pattern; ticket 003 wires signup to honor it). Hardening deferred to v1.1 per §10.3.
- **Service-role client added** (`src/lib/supabase/admin.ts`) — bypasses RLS for trusted cross-account work
  (admin tooling, Inngest pipeline, diagnostics). Distinct from the cookie-bound `server.ts` client used for
  advisor-scoped requests. Foundational; downstream admin/pipeline tickets reuse it.
- **`database.types.ts` hand-authored** to mirror the migration exactly, since `gen:types` needs a live DB.
  Includes a `PUBLIC_TABLES` const (single source for the health probe; `schema.test.ts` asserts it stays in
  lockstep with the migration). **Must be regenerated via `gen:types` and diffed on the first Docker-backed run.**
- **Schema verified statically, not via a live DB.** `src/types/schema.test.ts` reads the migration SQL (the
  schema source of truth) and asserts all 17 tables, the version columns, the immutability triggers, the
  assets audit chain, and RLS-on/owner-vs-internal policy split. This is the best "tests build from migrations"
  proxy available without Postgres; replace/augment with a real applied-migration test once Docker is available.

**Deferred verification (Docker unavailable):** `db push` idempotency, `gen:types` regeneration, and the live
`GET /api/health/db` round-trip after seeding. Commands to run once the local stack is up:
`npx supabase start && npx supabase db reset && npm run gen:types && curl localhost:3000/api/health/db`.

**Green this session:** `npm run typecheck`, `npm run lint`, `npm run build`, `npm test` (19 tests, incl. 7 new
for getDbHealth + schema consistency).

**Not committed:** kept local, consistent with the 001 convention.

---

## 2026-05-31 — Ticket 003: Auth (signup/login/verify/reset + OAuth + route guard)

**Context:** First user-facing auth slice. Supabase Auth owns `auth.users`; the app data model (002)
keeps a separate `public.users` whose id MUST equal `auth.uid()` — every RLS owner policy depends on it.
Same environment constraint as 001/002: no Supabase/Docker stack, so live auth round-trips couldn't run.

**Choices:**
- **User provisioning is a DB trigger, not application code.** `on_auth_user_created` (AFTER INSERT on
  `auth.users`, SECURITY DEFINER) mints the paired `public.users` + `public.accounts` rows for *every*
  signup path — email/password, Google OAuth, admin-created — in one place, inside Auth's own transaction.
  This guarantees the `id == auth.uid()` invariant can't be skipped or raced (an app-code path would have
  to duplicate it across the password callback and the OAuth callback). A second trigger
  (`on_auth_user_email_confirmed`) mirrors `auth.users.email_confirmed_at` → `public.users.email_verified_at`
  so the app's "verified" notion tracks Supabase without the app writing it. New accounts default
  `industry='ria'` (only v1 industry); firm_name/sub_industry/state are filled in onboarding (010/013).
  _Migration `20260531140000_auth_user_provisioning.sql`. The 002 seed (direct service-role inserts) is
  unaffected — the trigger only fires on `auth.users`._
- **Auth flows = route handlers through the `{data,error}` envelope, NOT Server Actions.** Honors the
  central `apiHandler` contract + curl-testability (build-loop step 4). The cookie-bound server client
  writes session cookies from a route handler fine. `/api/auth/{signup,login,logout,reset-password,
  update-password}` (POST) + `/api/auth/callback` (GET). The callback handles BOTH `?code=` (PKCE: OAuth +
  default email-confirm redirect) and `?token_hash=&type=` (verifyOtp, for a `{{ .ConfirmationURL }}`
  template) so it's robust to either Supabase email-template style; `next` is sanitized to same-origin.
- **§4.7 returning-user detection** keys off Supabase's anti-enumeration signal: a duplicate signup returns
  a `user` with an **empty `identities` array** and no error. → neutral "you already have a WRI account"
  with Sign in / Reset links, no status disclosure. Login errors are equally generic except the explicit
  verify-first case (`email_not_confirmed` → 403).
- **`src/middleware.ts` → `src/proxy.ts`.** Next 16 renamed the middleware file convention; keeping the old
  name logs a deprecation warning. `updateSession` (in `lib/supabase/middleware.ts`) refreshes the session
  via `getUser()` and guards: unauth + non-public → `/login?next=…`; authed on an auth page → `/dashboard`.
  API routes (`/api/*`) are pass-through at the proxy (they self-gate), or `/api/auth/*` would be unreachable.
- **shadcn input/label added by hand** (copy-into-codebase, like 001's Button). Label is a **native `<label>`,
  not Radix** — avoids adding `@radix-ui/react-label` for zero benefit (dependency guardrail). No new deps.
- **Password min length = 8** (`MIN_PASSWORD_LENGTH`), enforced client (inline, §7.6) + server (defense).
  Auth CTAs bumped to `h-11` (44px) for the §7.6 mobile tap-target minimum.
- **`/dashboard` is a placeholder** proving the auth boundary end-to-end; ticket 027 replaces it with the
  real shell. Verification arriving at `/dashboard?verified=1` shows a success banner (the "verified-success"
  state the ticket calls for).
- **Verification email still uses Supabase's built-in sender.** `emailRedirectTo` already targets our
  `/api/auth/callback`, so ticket 004 only swaps the sender to Resend templates — no flow change.

**Green this session:** `npm test` (51 tests — auth validation/service unit + login/signup frontend tests),
`npm run typecheck`, `npm run lint`, `npm run build`. Visual-QA (chrome-devtools MCP, connected this session):
Lighthouse a11y **100** / best-practices 100, zero console errors/warnings, responsive at 375px + desktop.

**Deferred verification (no Supabase/Docker this session)** — run once the stack is up
(`npx supabase start && npx supabase db reset`, real `NEXT_PUBLIC_SUPABASE_*` + Google provider configured):
1. Email signup → click verification link → lands authenticated on `/dashboard?verified=1`; confirm a
   `public.users` + `public.accounts` row pair exists with `id == auth.uid()`.
2. Google OAuth sign-in → same row pair created on first sign-in.
3. Hit `/dashboard` signed-out → 307 to `/login?next=/dashboard`; sign in → reaches it.
4. Password reset email → recovery link → `/update-password` → new password works.

**Not committed:** kept local, consistent with the 001/002 convention.

---

## 2026-05-31 — Foundation 001–003 committed

**Context:** First real commits of the platform code. The repo's only prior commit was the seed snapshot
(PRD + tickets + state + compliance scaffold) — it contained **no** `platform/` code; 001–003 were built
across earlier sessions but never committed.

**Choices:**
- **Branched off `main` (`foundation-001-003`), did not commit to `main` directly.** Harness convention is
  branch-first off the default branch. No remote exists, so this is local-only; fast-forward `main` when ready
  (`git checkout main && git merge --ff-only foundation-001-003`).
- **Three ticket-mapped commits in dependency order (001 → 002 → 003)**, each bundling that ticket's code with
  its `issues/00N` file; the cumulative `state/plan.md` + `state/decisions.md` rode with the 003 commit (so no
  commit is state-only, per the CLAUDE.md rule). File→ticket attribution by module: envelope/scaffold→001,
  schema/migrations/admin-client→002, auth/proxy/auth-migration→003. Intermediate commits aren't independently
  buildable (the shared `database.types.ts` lands in 002), accepted — no remote/CI verifies per-commit state.

---

## 2026-05-31 — Ticket 027 (Slice 1): Dashboard shell + Site Overview

**Context:** First customer-dashboard ticket and the first multi-tab shell. The full ticket (8-tab nav +
Site Overview + a complete Settings surface incl. account deletion) is well past the 5-file guardrail and
would fill context, so it was split.

**Choices:**
- **Two vertical slices.** **Slice 1 (this push):** shell + nav + 7 coming-soon stubs + Site Overview +
  §7.6 loading/empty/error — the visible landing that unblocks 028–032, with **zero schema change** (pure
  read-only UI). **Slice 2 (next):** the Settings surface (profile/email/password, notification prefs, domain
  settings, account deletion w/ 30-day grace), which needs its own migration — isolating it keeps Slice 1
  schema-free. Per CLAUDE.md "split if it fills context" + the >5-file guardrail.
- **Nav is a single config** (`lib/dashboard/nav.ts`): sidebar, mobile drawer, and per-tab headers all read
  it; `ready:false` tabs route to a `ComingSoon` placeholder that names the delivering ticket (§7.10 — no
  broken/half-built screens). `activeNavKey` resolves the active tab by **longest-prefix** match so the
  `/dashboard` root → Overview while `/dashboard/leads/123` → Leads. Flipping a tab live = one boolean.
- **Site Overview data layer** (`lib/dashboard/overview.ts`) keeps all derivation pure and unit-tested
  (`deriveDomainStatus`, `buildSiteOverview`, `ensureHttps`); only `getSiteOverview` touches IO (RLS-scoped
  `sites` read, `.maybeSingle()`, null = not-live empty state). Live URL prefers a verified custom domain,
  else the Vercel subdomain, else null (pre-deploy → disabled "Visit live site").
- **Badge primitive contrast fix (§7 / WCAG AA).** The bright semantic tokens (`success` L0.62, `warning`
  L0.75) fail 4.5:1 as text on a light tint; Lighthouse caught both the status badges (3.05:1) and the nav
  "Soon" pill. Reworked the tinted Badge variants to **darker hue-matched text via fixed oklch** (e.g.
  `text-[oklch(0.43_0.14_145)]` on `bg-success/15`) and made "Soon" a bordered `text-foreground/75` pill.
  Fixed-oklch (not a token) is acceptable because **v1 is light-only**; revisit when dark mode ships (v1.5).
  → a11y went 95 → **100**.
- **Visual-QA without a live session.** The dashboard is auth-gated and there's no Supabase this session, so
  drove chrome-devtools over a **temporary public preview route** (`/preview-027`) rendering the real shell +
  Site Overview with mock data (+ a placeholder `.env.local` so dev boots, + a temporary `PUBLIC_PATHS` entry).
  All of it — route, middleware edit, env, screenshots — **fully torn down** before finishing; working tree
  holds only 027 files. Result: a11y 100 / best-practices 100, console clean, responsive 375px + 1280px,
  mobile drawer verified. This is the repeatable recipe for QA'ing any future auth-gated screen pre-Supabase.

**Deferred (no Docker/Supabase, same as 001–003):** live read of the `sites`/`accounts` rows through
`getSiteOverview` + the layout's account query. Rendering is proven via the mock-data preview + component
tests; the live round-trip joins the 001–003 catch-up list (run once `npx supabase start && db reset` + real
`NEXT_PUBLIC_SUPABASE_*` are in place): sign in → `/dashboard` shows the empty state with no site row, then a
seeded `sites` row surfaces the live URL + correct domain badge.

**Green this session:** `npm test` (75 — +24 for nav/overview logic + nav/site-overview component tests),
`npm run typecheck`, `npm run lint`, `npm run build`.

---

## 2026-05-31 — 027 Slice 2: Settings tab (PRD §12.9)

- **Pure/IO split forced by the client boundary.** `SettingsForm` is a client component and needs the
  `AccountSettings` type + `LEAD_FREQUENCIES`; importing them from a module that also pulls
  `lib/supabase/server` (which imports `next/headers`) breaks the Turbopack build ("only available in
  Server Components"). So `lib/account/settings.ts` is the **client-safe core** (types, validators,
  `deletionState`) and `lib/account/service.ts` is the **server IO** (Supabase reads/writes). Same shape as
  `auth/validation.ts` (pure) vs `auth/service.ts` (IO). Routes import IO from `service.ts`; the form imports
  types/constants from `settings.ts`.
- **Email change is an auth concern, not an `accounts` write.** `changeEmail` lives in `auth/service.ts` and
  calls Supabase `auth.updateUser({ email }, { emailRedirectTo })`, which emails a confirmation to the *new*
  address — the change only lands on click (back through `/api/auth/callback?next=/dashboard/settings`). The
  old email stays active until then, so the UI says "confirmation sent", never "changed". 422 (already in
  use) maps to a neutral message — no account enumeration (§4.7). Password change reuses the existing
  `/api/auth/update-password`; no new route.
- **Account deletion records intent only; the purge is deferred.** `requestAccountDeletion` stamps
  `deletion_requested_at` (idempotent — a second request keeps the original timestamp via an
  `is('deletion_requested_at', null)` guard, so a re-click can't extend the window); `deletionState` derives
  the 30-day grace end + whole-days-remaining (rounds **up** so it hits 0 only at true expiry). The actual
  data purge needs Inngest (009) + a cron — out of scope here. Distinct from subscription cancellation (§12.9).
  UI danger-zone uses a **two-step inline confirm** (no modal dependency); pending state shows the grace
  banner + "Keep my account" (DELETE → cancel).
- **Domain settings shipped read-only.** §12.9 lists "re-trigger DNS verification", but that needs the Vercel
  API (ticket 025). Rather than a button that does nothing, the domain card shows status + DNS guidance only;
  the re-verify action joins 025. Reused `getSiteOverview`/`deriveDomainStatus` for the status read.
- **No RLS change.** All four new columns sit on `accounts`, already covered by the `accounts_owner` FOR ALL
  policy (`user_id = auth.uid()`); the IO `.eq('user_id', uid)` filters just narrow to the single v1 row.
- **Visual-QA recipe reused.** Same temp-public-preview-route + dummy `.env.local` approach as Slice 1
  (route `/preview-settings`, the underscore-prefix `_preview-settings` is a *private folder* in the App
  Router and won't route — renamed). Fully torn down. Result: best-practices 100, a11y 98 in the bare preview
  — the only deduction is `landmark-one-main`, which the dashboard shell's `<main>` supplies in production
  (so effectively 100); console clean; 375/1280px; two-step delete confirm exercised live.

**Deferred (no Docker/Supabase, same as 001–003):** live read/write of the new `accounts` columns through
`service.ts`. Logic is proven via `settings.test.ts` (12) + `settings-form.test.tsx` (6) + the mock preview;
the live round-trip joins the catch-up list (sign in → Settings → edit profile/notifications → request +
cancel deletion → change email confirmation).

**Green this session:** `npm test` (96 — +21 over Slice 1's 75), `npm run typecheck`, `npm run lint`,
`npm run build`. **027 now fully Done (both slices).**

---

## 2026-05-31 — 00A: Platform design direction (owner-decided)

Owner flagged the shipped UI as generic/low-trust (default shadcn: cold slate + generic indigo, flat). Ran a
4-question direction round; decisions:

- **Aesthetic = Mercury/Ramp** (warm trust-fintech: calm, rounded, conservative, soft layered depth) — chosen
  over Stripe-grade, Linear, and Vercel/Geist. Build it as a distinctive WRI identity at that craft bar, not a
  clone of any one product.
- **Accent = emerald / teal** — over indigo/violet, deep blue, and near-neutral. Money/growth/trust, and
  deliberately off the indigo-fintech default.
- **Mode = light-first only** for v1 (dark deferred to v1.5; keep vars stubbed).
- **Density = balanced** (roomy empty/onboarding, tighter on data views).

**Why it's a foundation ticket, not a Settings tweak:** the blandness is systemic (no design system was ever
defined — 001 just used shadcn defaults), so 00A defines tokens + primitives once and re-skins 001/003/027,
gating the look of all future platform UI. **Scope = platform only**; the three customer templates (016–019)
keep their own distinct Trust/Modern/Boutique design languages.

**Execution:** Slice 1 = warm-neutral + emerald token set in `globals.css @theme` + upgraded Button/Input/
Label/Badge + a shared `Card` primitive + re-skin Settings as the proof on the `:5500` preview for owner
sign-off (HIL); Slices 2–3 roll it across 027 then 003/001 (AFK). Must preserve the §7 WCAG-AA badge-contrast
fix under the new palette, and resolve the primary(emerald)↔success(green) collision by lightness + usage.

---

## 2026-05-31 — 00A: Platform design system built (Slices 1–3)

Owner approved the Mercury/Ramp + emerald direction on the Slice-1 Settings proof ("yeah looks better"), then
chose to finish the rollout before new feature tickets. Built and rolled out:

- **Tokens (`globals.css @theme`) are the single source.** Warm stone neutrals (low-chroma ~hue-80) replace
  cold slate; `--primary` = deep emerald **darkened to L0.48** so white button text clears WCAG AA (a brighter
  emerald failed contrast); semantics re-tuned warm; `--radius` 0.75rem; soft warm-tinted `--shadow-{xs,sm,card}`.
- **Type pairing = Fraunces (display serif) + Hanken Grotesk (body)** via `next/font/google` — the
  frontend-design skill calls for distinctive type over Inter-everywhere; a soft serif on headings reads
  "established/editorial-finance," fitting the regulated audience. Headings get the serif via an `@layer base`
  `h1,h2,h3` rule, so every screen inherits it.
- **`next/font` + token changes need a dev-server restart, not just hot-reload.** First reload still showed
  indigo buttons / sans headings; killing the dev server + `rm -rf .next` + restart applied them. Worth
  remembering for future theme work.
- **New shared `Card` primitive** consolidates the hand-rolled `bg-card rounded-xl border shadow-sm` that
  Settings and Site Overview each duplicated → `rounded-2xl shadow-card`, `tone="danger"` for destructive
  sections. Sidebar active state uses an **emerald `bg-primary/10` pill** (the plain `bg-accent` wash was too
  subtle on the warm card to read as selected).
- **Auto-adoption model (answered for the owner):** global tokens + the shared primitives mean future platform
  tickets inherit the look for free *as long as they build on the primitives* — now an enforced 00A acceptance
  rule, not a convention. Only pre-00A hand-rolled markup needed back-fill (the Slice 2–3 work).
- **Scope = platform only.** Customer templates (016–019) keep their distinct Trust/Modern/Boutique languages.

Visual-QA via the same temp-preview recipe (added `preview-dashboard` alongside `preview-settings`, broadened
the middleware allowance to `/preview*`, dummy `.env.local`) — all fully torn down; tree holds only real files.
Results: Settings `color-contrast` perfect + bp 100; **login a11y 100 / bp 100**; console clean; 390/1280px.

**Green:** `npm test` (96), `typecheck`, `lint`, `build`. **00A Done. Light-only for v1; dark vars stubbed (v1.5).**

---

## 2026-06-01 — 008 Gemini client wrapper + cost guard (PRD §8.1, §8.4, §8.2)

Built parallel with 009 in an isolated git worktree; integrated back onto `foundation-001-003`.

- **One deep module, callers pass intent not model params.** `src/lib/gemini/` is the only place the model SDK
  lives. Callers pass `{ useCase, schema, prompt }`; the module picks the model (§8.1), enforces budgets,
  tracks cost, and types every failure. This is the §8 chokepoint the whole pipeline (006/012/020/022) sits on.
- **Dependency added: `@google/genai ^2.7.0`** — the official Google Gen AI SDK. Nothing existing covers Gemini
  access; we deliberately route ALL model calls through this one wrapper so the SDK surface never leaks to
  callers. (`npm install` flagged 2 moderate-severity advisories in transitive deps; not `audit fix --force`'d
  — that pulls breaking majors. Revisit before beta.)
- **Fail loud, never truncate (§8.2.7).** Exceeding a hard token cap throws `TokenBudgetExceededError` rather
  than silently trimming the prompt — a trimmed compliance prompt could drop a required disclosure. Same stance
  on cost: `CostBudgetExceededError` stops the pipeline *before* spending past the <$2/site guard, not after.
- **`generateJSON` repairs once, then errors.** Malformed model output gets one repair pass (re-prompt with the
  validation errors); still-bad output raises `SchemaValidationError`. No free-text fallthrough — callers always
  get a typed object or a typed error.
- **009 seam — reconciled at integration.** 008 and 009 were written in parallel and defined the rate-limit
  contract independently: 008's `GeminiRateLimitError` had `retryable:true` but 009's `isRateLimitError()` guard
  is duck-typed on `isRateLimit===true` and its logger reads `service`/`endpoint`. Reconciled by adding
  `isRateLimit:true` + `service:"gemini"` + `endpoint`(=model) to `GeminiRateLimitError` so 009 recognises and
  logs it WITHOUT importing the gemini tree. Contract pinned in `gemini/errors.test.ts`; the end-to-end
  "009 actually catches a real GeminiRateLimitError" proof lives in 009's inngest seam test.
- **Deferred (`[~]`): live calls + separate dev key (§9.3).** No Gemini key this session (same constraint as
  001–003). The real SDK is wired and `GEMINI_API_KEY` activates it; unit tests run against a mocked SDK
  boundary (no Gemini emulator exists). **Catch-up:** set `GEMINI_API_KEY` (low-quota dev key) in
  `platform/.env.local`, `npm run dev`, then `curl localhost:3000/api/dev/gemini-check` — expect a tiny
  structured object + token usage + estimated cost; then flip the §9.3 acceptance box.

**Green:** `npm test` (126), `typecheck`, `lint`, `build`. **008 Done.**
