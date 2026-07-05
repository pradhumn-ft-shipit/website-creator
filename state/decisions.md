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

---

## 2026-06-01 — 009 Inngest setup + order state machine (PRD §9.2, §13.1, §13.2, §18.1)

Built parallel with 008 in an isolated git worktree; integrated back onto `foundation-001-003`.

- **Pure state machine, separate from Inngest IO.** `lib/orders/transitions.ts` is a pure ordered-state +
  legal-transition table (no IO, fully unit-tested incl. the `scrape_failed → docs_upload_fallback` branch);
  `state-machine.ts` does the persisting `transitionOrder`. Same pure/IO split as `auth/` and `account/`.
  Illegal hops throw `IllegalTransitionError` rather than silently persisting a bad state — the order machine
  is the audit spine, so an impossible transition must be loud.
- **Step bodies are thin stubs on purpose.** Each §18.1 stage is a `step.run` no-op that just advances state +
  carries its §13.2 retry policy. Real work replaces the stubs in 012/014/020/022/024/025/026. This keeps 009
  reviewable and lets downstream tickets land one step at a time without re-touching the spine.
- **Dependency added: `inngest ^3.54.2`** — the locked background-jobs runtime (CLAUDE.md stack). Vercel
  functions cap at 90–120s; scrape+generate+build+deploy exceeds that, so all long work lives in Inngest steps
  and the Next API only enqueues. (Same transitive `npm audit` advisories as 008's install; not force-fixed.)
- **No migration needed.** 002 already shipped `orders.state_machine_position` and the `admin_alerts` table,
  so 009 is schema-free — it only reads/writes columns that exist.
- **008 seam — reconciled at integration (see 008 entry).** 009 catches rate-limits via the duck-typed
  `isRateLimitError()` guard, so it never imports 008's class for the catch. Added a real cross-ticket test
  (`inngest/errors.test.ts` imports `GeminiRateLimitError` and asserts the guard recognises it + can read
  `service`/`endpoint`) — this is the proof the parallel-built seam actually closes, not just two matching
  literals. On a rate-limit, `handleStepFailure` logs to `state/rate-limits.md` then rethrows for Inngest backoff.
- **Q4c deliberately NOT applied (still open).** Ticket text says Layer-3 gating should become flagged-only, but
  that was an open HIL TBD, not a settled decision — so 009 implemented the original §5.2 "first-50 OR flagged"
  gate and centralized it in `layer3Required()` so flipping to flagged-only later is a one-function change.
  Flagged in plan.md Open TBDs; needs the owner's call before changing (business impact: how many sites get
  manual Layer-3 review during alpha vs. auto-pass).
- **Deferred (`[~]`): live `npx inngest-cli dev` round-trip + live DB writes.** No infra/Docker this session
  (same as 001–003). Client + serve route + typed `order.created` function are wired and build-verified; tested
  against a mocked `step` + mocked service-role client. **Catch-up:** `npm run dev` + (separate terminal)
  `npx inngest-cli@latest dev`, fire `order.created` from the Inngest dev UI with a seeded order id, watch it
  walk to `dns_monitoring`; force a step throw to see an `admin_alerts` row written. Then flip that acceptance box.

**Green:** `npm test` (164), `typecheck`, `lint`, `build`. **009 Done.**

## 2026-06-01 — Review fixes 008/009/00A (state/reviews/2026-06-01-008-009-00A.md)

Picked up the six findings from the fresh-context review of 008 + 009 + 00A. The cluster is in the
cost guard — the stated hard guardrail (<$2/site) — so those were weighted heaviest.

- **#1 (HIGH) — cost guard now counts failed/over-cap/repair attempts.** `GeminiClient.generateJSON`
  recorded token spend only on the success path, so an `assertWithinOutputCap` throw or an
  all-repairs-fail `SchemaValidationError` dropped every billed attempt — and the failure/repair loop
  is exactly where per-site cost balloons. Split `CostAccumulator.record` into **`recordUsage` (always,
  per attempt)** + **`recordImage` (success-only)**; the client now calls `recordUsage` immediately after
  `readUsage`, *before* the output-cap and parse checks that can throw. `record(model,usage,isImage)` is
  kept as a back-compat convenience (= `recordUsage` + optional `recordImage`). Image quota is consumed
  only by a *successful* image call, so a failed image bills tokens but doesn't burn one of the 3 slots.
- **#2 (MEDIUM) — chose enforcement-in-the-client (option a), not caller contract.** `assertCanSpend` /
  `assertCanGenerateImage` had zero callers — the dollar + image caps were left to the (still-stubbed)
  pipeline. The client is documented as "the one place every AI call goes through… enforces budgets," so
  the guard belongs there where it can't be forgotten downstream. `generateJSON` now calls
  `assertCanGenerateImage()` once before the loop (4th image never dispatches) and `assertCanSpend(worstCase)`
  before **every** dispatch incl. repairs. **Worst-case pre-estimate = known input + the operation's hard
  `capOutput`** (the most one call can produce, since `assertWithinOutputCap` rejects more) → the guard
  provably never lets actual spend exceed the cap. Headroom is large (full-site worst case ≈ $0.20, image
  ≈ $0.06, vs the $2 cap) so this never false-halts a legitimate site. Tests prove a site halts at the
  cap **before** the SDK boundary is called (nothing billed).
- **#5 (LOW, folded in) — dropped the throwaway accumulator in `estimate()`.** `generateJSON` now computes
  the returned `costUsd` via the already-exported `estimateCostUsd(model, aggregate)`; deleted the private
  `estimate()` that spun up a `new CostAccumulator(Infinity)` per call.
- **#3 (MEDIUM) — deletion re-read surfaces DB errors.** `requestAccountDeletion`'s already-pending branch
  used `.single()` and swallowed `{ error }`, so a transient DB error collapsed into the misleading
  "Failed to schedule account deletion". Now `.maybeSingle()` + `throw error` on failure, matching
  `getAccountSettings`.
- **#4 (LOW) — `AccountRow` aligned to the migration.** `lead_notification_frequency` + `system_alerts_enabled`
  are `NOT NULL DEFAULT` in `20260531150000_account_settings.sql`; typed them non-null (the `??` fallbacks
  stay as defense-in-depth). Kept the hand-rolled shadow type rather than wiring the generated DB types
  (gen:types still pending Docker).
- **#6 (NOTE) — no behavior change, made the obligation greppable.** Added `TODO(020/006)` at the
  `layer3Required({ verdict:"pass", siteIndex:0 })` stub so the downstream ticket that owns the Layer-2
  outcome threads the real verdict + siteIndex (otherwise every post-50 passing site keeps routing through
  manual review). Tracked here + in plan.md.

**Not done:** no unit test for #3 — `account/service.ts` IO creates its own Supabase client (no injection
seam like `auth/service.ts`), and this module has no Supabase-mock harness yet (live read/write still
deferred, no Docker). The fix is a 1:1 consistency change with the proven `getAccountSettings` pattern;
verified by typecheck + the cost-guard tests carry the review's test weight.

**Green:** `npm test` (173, +9 new: 6 client cost-guard + 3 cost split), `typecheck`, `lint`, `build`.

---

## 2026-06-01 — 033 (Slice 1) Admin /admin/orders: gate + queue + retry (PRD §11.1, §13.2, §13.4)

First admin ticket — establishes the admin foundation 034–036 hang off. Built as Slice 1
(gate + shell + order list + Retry/Dismiss); the order **detail view** is Slice 2.

- **Admin identity = env-var email allowlist (`ADMIN_EMAILS`), owner-decided.** No admin/role
  concept existed; asked the owner (tech + business framing) and they picked the allowlist over a
  DB `users.is_admin` column. Rationale: internal-only tool, tiny alpha team, no admin-management UI
  in v1 scope → zero schema churn, deny-by-default, no bootstrap problem. Trade-off accepted: adding/
  removing an admin is an env edit + redeploy (no self-service). Centralized in `lib/admin/auth.ts`
  as a pure `isAdminEmail(email, allowlist)` (exhaustively unit-tested) + thin IO wrappers
  `requireAdmin()` (pages: unauth→`/login`, non-admin→`notFound()` = **least disclosure**, a regular
  advisor never learns `/admin` exists) and `assertAdmin()` (API: `AppError` 403). Swapping to a DB
  role later only touches `isAdminEmail`'s call sites. **TBD: populate `ADMIN_EMAILS` before deploy.**
- **Two layers of gating, no proxy change.** The existing proxy already bounces unauthenticated users
  off any non-public path → `/login`; the *admin* check (authenticated-but-not-admin) lives in the
  `/admin` layout (`requireAdmin`) + each `/api/admin/*` route (`assertAdmin`). `/api/*` stays
  proxy-pass-through and self-gates. No new env var leaks client-side (`ADMIN_EMAILS` is server-only).
- **Sliced (the full ticket is well past the 5-file guardrail, same as 027).** Slice 1 = gate + shell +
  list + actions (a complete, visible, testable vertical slice that satisfies 4/5 acceptance criteria
  and unblocks 034–036's admin-gate dependency). Slice 2 = the detail view, which needs its own schema
  (see below).
- **`lib/admin/orders.ts` is one deep module** (read + classify + recover), split pure-core/IO like the
  rest of the repo. Pure: `stateTone`/`stateGroup` (failure→danger, review→warning, complete→success,
  else in-progress/info), `humanizeStatus`, `formatDuration`, and `shapeAdminOrders` (shape+filter+sort,
  fully unit-tested with injected `nowMs`). IO: `listAdminOrders` reads via the **service-role client**
  (orders/admin_alerts are RLS-internal — deny-by-default to the cookie client) embedding
  `accounts(firm_name, users(email))` + `admin_alerts(...)`. Filtering is in-memory over the shaped rows
  (alpha volume ≤50 sites); push to SQL if volume grows.
- **"Driven by admin_alerts."** The list is the full `orders` queue (§11.1 shows all orders + a
  "last failure (if any)" column), *enriched* with each order's unresolved `order_failed` alert — that
  alert is what makes a row actionable (Retry/Dismiss) and powers the "Needs attention" filter. So the
  actionable queue is alert-driven while the table still shows everything.
- **Retry semantics (v1 = restart, not resume).** 009's pipeline is still a single
  `order.created`→top-of-pipeline walk with **stub** steps, and failure states are terminal in the
  forward-only transition table (`transitionOrder` can't exit them). So Retry is a deliberate admin
  **reset** (service-role): status→`payment_received`, `state_machine_position`→"0", clear
  `failure_reason`, bump `retry_count`, resolve the open `order_failed` alert(s), then re-send
  `order.created`. The injected `send`/`client` make it unit-testable; `retryOrderById`/`dismissOrderAlert`
  wire the real Inngest client. **TODO(012–025):** once steps are real + idempotent, resume from the
  failed step (`alert.step`) instead of restarting — marked in `orders.ts`. Retry guards on
  `isFailureState` (409 otherwise).
- **"Manually intervene" / order-level "Cancel" → Dismiss.** §18.1 has no `cancelled` order state and
  there's no clean target, so order-level cancel is out of scope; subscription cancel is 032. The two
  recovery actions are **Retry** (re-run) and **Dismiss** (resolve the alert without re-running, for
  out-of-band fixes / false alarms). Both are confirmed via an inline two-step (no modal dep — same
  pattern as 027's danger-zone).
- **Time-in-state is approximate (schema-free, like 027 Slice 1).** We don't persist a per-transition
  timestamp. The column measures from the failure alert when stuck on a failure (**accurate for the rows
  admins act on**) and from `created_at` otherwise. **Slice 2 adds an `order_state_events` history table**
  (written by `transitionOrder` going forward) that powers both the detail view's "state-machine history"
  AND precise time-in-current-state — chose to defer it there rather than add a soon-superseded
  `status_changed_at` column now.
- **Badge gained a `destructive` (red) variant** for the failed state — AA-safe dark-red text on a light
  `bg-destructive/12` wash (matches the 00A fixed-oklch badge pattern; v1 light-only). Reused by 034's
  violations queue. The admin shell's disabled "Soon" section labels were initially `text-muted-foreground/60`
  (2.51:1 — Lighthouse caught it); bumped to the dashboard's proven AA treatment (`text-muted-foreground`
  label + `text-foreground/75` pill) → a11y 96 → **100**.
- **Admin console = its own chrome** (`components/admin/shell.tsx`): a dense, desktop-first top-nav across
  the §11 surfaces (Orders live; Compliance/Leads/Email-log/Health are "Soon", named for 034–036), distinct
  from the advisor dashboard's sidebar but on the same 00A tokens/primitives. §7.10 allows lower-fidelity
  admin UI; never broken.
- **Visual-QA via the temp-preview recipe** (same as 027/00A: dummy `.env.local` + `/preview-admin` public
  route rendering the table with mock data + temp middleware allowance — **all fully torn down**, tree holds
  only real 033 files). Result: Lighthouse **a11y 100 / best-practices 100**, console clean, desktop 1280px +
  mobile 375px (header collapses, table scrolls), Retry two-step confirm exercised live.
- **Deferred (`[~]`, no Docker/Inngest this session — same as 001–009):** live admin read through
  `listAdminOrders` (needs Supabase + `SUPABASE_SERVICE_ROLE_KEY`) and a live retry round-trip (needs the
  Inngest dev server to observe the re-enqueued `order.created`). Logic is proven via `orders.test.ts`
  (shaping/filter + retry/dismiss with injected client+sender) + the frontend test + the mock preview.
  **Catch-up:** set `ADMIN_EMAILS` + real Supabase env, sign in as an allowlisted user → `/admin/orders`
  shows the queue; seed a `build_failed` order + `order_failed` alert → Retry resets it and (with
  `npx inngest-cli dev` running) re-fires the pipeline.

**Green:** `npm test` (201, +28: 9 auth + 15 orders/actions + 7 frontend... 28 total new), `typecheck`,
`lint`, `build` (all 4 admin routes compile dynamic). **033 Slice 1 done; Slice 2 (detail view) next.**

---

## 2026-06-01 — 033 (Slice 2) Admin order detail view (PRD §11.1) — 033 FULLY DONE

Closes the last open 033 acceptance criterion: `/admin/orders/[id]` shows full state-machine
history, intake summary, generated-content preview, compliance violations, and deployment logs,
plus Retry/Dismiss. Builds on Slice 1's gate/shell/queue/actions.

- **New `order_state_events` table (the one real schema decision, per the handoff).** 009's
  `transitionOrder` only overwrites `orders.status` + `state_machine_position` — it keeps NO
  history, so "full state-machine history" needed an append-only audit table. Migration
  `20260601120000_order_state_events.sql`: `(id, order_id→orders, from_status, to_status,
  occurred_at, note)`, indexed `(order_id, occurred_at)`. **Internal/operational table** — RLS
  enabled, NO policy (service-role only), same posture as `admin_alerts`. **Deliberately NOT a
  §10.1 core table:** it is added in a *separate* migration and **excluded from `PUBLIC_TABLES`**
  (the health-probe / §10.1 list stays pristine at 17 — the lockstep test `PUBLIC_TABLES ===
  EXPECTED_TABLES` would otherwise break, and an audit log isn't part of the core data model). It
  IS added to `database.types.ts` so the service-role queries are typed, and gets its own
  `schema.test.ts` describe block (creates table / indexed / RLS-on / policy-less / not in
  PUBLIC_TABLES). `gen:types` still pending Docker — hand-authored to match, like the rest of 002.
- **History is written best-effort, never blocking the transition.** New `recordStateEvent`
  (exported from `lib/orders/transitions.ts`) inserts one row after every successful
  `transitionOrder` persist (`from`→`next`), and is also called by `retryOrder` for the admin
  reset (`from = failed status`, `to = payment_received`, `note = 'admin retry'`) since that reset
  bypasses the forward-only machine. It **swallows its own write errors**: the order's status is
  already persisted and history is an audit aid, not the source of truth — same non-masking posture
  as `escalateOrderFailure`. So a history-write failure can never fail (or roll back) a transition.
- **Precise time-in-state, backward-compatibly upgraded.** `shapeOne` (the Slice-1 queue shaper)
  now prefers the **latest `order_state_events.occurred_at`** as the "entered current state"
  reference for time-in-state — more accurate than Slice 1's alert/created_at approximation. The
  upgrade is **additive**: rows with no events (orders predating the table, or none recorded yet)
  fall through to the old logic, so every Slice-1 queue test stays green unchanged. `listAdminOrders`
  embeds `order_state_events(occurred_at)` to power it.
- **`getAdminOrderDetail(orderId)` = one embedded service-role read.** Pulls the order + firm +
  owner email + the account's `sites → deployments` + `intake_data` + `generated_content` +
  `compliance_violations` + `order_state_events` + `admin_alerts` in a single Supabase nested
  select, `.maybeSingle()` → `null` for an unknown id (→ `notFound()`). Pure shaping
  (`shapeOrderDetail` + `buildStateHistory`) is fully unit-tested with injected `nowMs`, same
  pure-core/IO split as the rest of `orders.ts`.
- **`buildStateHistory` anchors the timeline at order creation.** The order's first state is the
  first event's `from_status` (its status before any recorded transition), placed at `created_at`;
  each event marks entry into the next state; each entry's duration runs to the next entry, and the
  current (last) entry runs to `now`. With no events, a single current entry from creation. This
  keeps the timeline meaningful even before/without recorded transitions.
- **Content/intake are summarized, not dumped.** Generated content shows page/section/version/
  confidence/ruleset/approval (newest version first), NOT raw `content_json` (huge + not useful in
  a control room). Intake shows the URL + booleans (scrape captured? structured captured?) + doc
  count, not the raw scrape/intake JSON. Violations show severity (color-coded: high→destructive,
  medium→warning, low→neutral) + field path + description + resolved state. Deploy logs show
  status/version/trigger/compliance/Vercel-id, newest first.
- **`OrderActions` extracted to its own client component** (`components/admin/order-actions.tsx`)
  and reused by BOTH the queue table and the detail header — identical Retry/Dismiss two-step
  confirm in both places, no duplication. The table now takes `{orderId, retriable, hasAlert}`
  props instead of the whole `AdminOrder`. Row **Order-id cell → `/admin/orders/[id]`** link added.
- **Scope note (5-file guardrail):** this slice spans ~12 files (schema + types + test + 009 touch
  + test + data layer + test + page + not-found + detail component + extracted actions + table +
  frontend test) — well past the literal guardrail, but it is **one coherent vertical slice** (a
  single screen), same as Slice 1 (9+) and 027. The handoff offered a 2a/2b split; I kept it whole
  because the page scaffold + schema + data layer must all land together for *any* detail content to
  render, and a half-built screen is worse to review than a complete one. Kept modular (deep detail
  component with internal sections; extracted shared actions) and the change is additive/low-risk to
  the green Slice-1 queue (no existing queue test rewritten).
- **Visual-QA via the same temp-preview recipe** (dummy `.env.local` + `/preview-order-detail`
  public route rendering `OrderDetail` with a failed-order mock + temp `/preview` middleware
  allowance — **all fully torn down**, tree holds only real 033 files). Result: Lighthouse
  **a11y 100 / best-practices 100**, console clean, desktop 1280px + mobile 375px (header stacks,
  tables horizontal-scroll within their cards — never broken). Retry two-step confirm covered by
  the frontend test.
- **Deferred (`[~]`, no Docker/Inngest — same as 001–009):** live embedded read through
  `getAdminOrderDetail` + a live transition writing real `order_state_events` rows. Proven via the
  pure shaping/history tests + the frontend test + the mock preview. **Catch-up:** `db push` the new
  migration, run a pipeline (or a manual `transitionOrder`) to populate events, open
  `/admin/orders/[id]` as an allowlisted admin. Queue time-in-state then shows the precise value.

**Green:** `npm test` (**225**, +24 over Slice 1: 4 schema + 1 transition + 14 orders detail/history/
retry-event/time-in-state + 5 frontend), `typecheck`, `lint`, `build` (`/admin/orders/[id]` compiles
dynamic). **033 FULLY DONE** (all 5 acceptance criteria `[x]`).

---

## 2026-06-01 — 007 Prompt + eval harness (PRD §8.2, §8.6)

**Context:** Picked 007 as the next AFK over 004 (more downstream leverage) and 011 (leaf). Reasoning: 007 is
the §8.2.8 *gate* (dev-infra tier > feature tier in CLAUDE.md prioritisation) and is 100% verifiable offline this
session, whereas all five of 004's acceptance criteria need a live Resend key + verified domain we don't have
(004 would ship ~entirely deferred — better picked alongside its domain prereq + 028). 007 is the successor to
008: **008 client → 007 prompts+evals → 020 generation.**

- **Harness lives in `platform/`, not `compliance/`** (divergence from the CLAUDE.md Build/Test/Run table, which
  loosely grouped `npm run evals` under "run from `compliance/`"). Why: the eval gate must import the platform's
  prompt loader, the versioned `OutputSchema` (`GENERATED_SITE_SCHEMA`), and 008's schema-validation contract.
  There is no `compliance/package.json`, and a separate package would force duplicating the TS output schema or
  importing compiled JS. So `npm run evals` is a **platform** script. `lint:rulesets` (005's deliverable) can
  still live under `compliance/` later. **Flagged to owner** — if the CLAUDE.md table should be corrected to say
  "evals run from `platform/`", that's a one-line doc edit (left untouched here; project instructions aren't
  edited without ask).
- **Evals are offline / fixture-based, not model-in-the-loop.** No live Gemini call (no key — same constraint as
  008/009). A golden case is an *input fixture + expected properties*; output-property cases check a committed
  candidate output, prompt-contract cases check the prompt text itself. This makes the gate deterministic and
  CI-ready, and is the honest meaning of §8.6 without a key. **Clean extension when 020 + a key land:** run each
  case's input through the real model and assert the *same* property checks on real output — the checker
  machinery is unchanged.
- **Eval baseline is a frozen §18.2 list, decoupled from 005's ruleset.** `evals/baseline.ts` hard-codes the
  prohibited terms + required disclosures from PRD §18.2 (RIA quick-reference). It is deliberately NOT loaded from
  `compliance/ria/v1.0/rules.json` (still an empty placeholder, and a long-lived artifact that will be *edited*).
  Why: the gate must turn red **only** on a prompt/schema regression — not flicker because someone edited the
  ruleset. 006's ruleset loader is the source of truth for *live* Layer-2 validation; the evals keep their own
  fixed baseline.
- **Prohibited-term scan uses only context-free terms + word boundaries.** Baseline includes guarantee(d/s),
  promise(d/s), "no risk", "risk-free/free". It deliberately omits §18.2's context-dependent ones
  ("best"/"top-ranked"/"outperform" *without substantiation*) — a deterministic substring gate would
  false-positive on legitimate copy. Those are Layer-2's (006) nuanced job. Word-boundary `\bterm\b` matching so
  "promise" never matches "compromise" (pinned by a golden case + a unit test).
- **`npm run evals` is a SEPARATE vitest project, not part of `npm test`.** `vitest.evals.config.ts` globs
  `evals/**/*.eval.ts` (node env, no jsdom/jest-dom) while the default config globs `src/**` — so the prompt gate
  is a distinct CI step from the unit suite, with no new dependency. `--reporter=verbose` so per-case PASS/FAIL is
  visible; `formatReport` also prints a readable report with the failing-check detail. Nonzero exit on failure
  (confirmed exit 1).
- **Schema validates structure + the confidence/sources invariant ONLY.** `GENERATED_SITE_SCHEMA.parse` does not
  check "no prohibited terms" or "CRS link present" — those are content properties owned by the evals and Layer-2.
  Keeping the schema's job narrow avoids two sources of truth for compliance content rules.
- **Negative-case semantics test the gate's teeth without a permanently-red suite.** A case declares
  `expect:"pass"|"fail"`; a `fail` case is `ok` precisely when ≥1 asserted check fails (the bad input was caught).
  So the committed `broken-prompt.md` case stays green by being correctly rejected. The literal "broken prompt
  makes evals fail" (acceptance #4) was additionally demonstrated live (temp-removed `{{compliance_ruleset}}` from
  the real `generate-site.md` → red + exit 1, then restored).
- **5-file guardrail:** this slice spans ~14 files (3 modules × {impl,test} + 4 prompts + baseline/cases/fixtures
  + eval spec + config + package.json + barrel). Past the literal guardrail, but **one coherent vertical slice**
  (the harness is a single deliverable per the ticket), built core-first with TDD (schema → loader → runner, each
  red→green before the next). No DB/schema change, no new dep.

**Green:** `npm test` **258** (+33: 12 schema + 8 loader + 13 runner), `npm run evals` **15/15 cases**,
typecheck / lint / build all green. No deferral — fully verifiable offline.

## 2026-06-01 — 005 RIA v1.0 compliance ruleset + lint:rulesets (PRD §5.3, §5.5, §5.6, §18.2)

**Context:** Picked 005 as the next AFK (owner-confirmed) over 004/011. Rationale: 005 is the root of the
compliance moat — it unblocks 006 (→ 020/021/029/031/034) + 016 + 023 — and its *build* acceptance is 100%
verifiable offline (the `lint:rulesets` gate runs locally; no Docker / API key / live infra), unlike 004 (needs
a verified Resend domain) and 011 (needs Docker for the live DB write). Only the final two-person publish
sign-off is human-gated, exactly as Q3a specified. Done in two slices in one session.

**The linter lives in `compliance/`, zero-dependency.** Resolves the flag left in the 007 entry (evals stayed in
`platform/` because they import the TS output schema; `lint:rulesets` has no such coupling, so it belongs under
`compliance/` per the CLAUDE.md Build/Test/Run table). `compliance/package.json` (`type:module`, **no deps**):
`lint:rulesets` → `node scripts/lint-rulesets.mjs`; `test` → `node --test`. Chose a hand-rolled structural
validator over `ajv` so the workspace needs **no `npm install`** (fully offline, no dependency to justify per the
guardrail). A real Draft-2020-12 `compliance/rules.schema.json` ships alongside for **editor support + contract
docs**, but `scripts/lint.mjs` is the *authoritative* validator (it does semantic checks JSON Schema can't:
citation-id resolution, on-disk manifest reference resolution, the §5.7 publish gate, §18.2 footer markers).

**One deep module, pure-checks + IO-edge split** (same pattern as auth/validation vs auth/service):
`lint.mjs` exposes pure `checkRulesJson / checkCitations / checkManifest(_, exists) / checkReviewGate /
checkFooter` (operate on parsed objects + a file-exists predicate — unit-testable, no fs) plus IO runners
`lintRuleset(dir)` / `lintAll(root)` / `formatReport` (fs only here). Every check returns flat, path-qualified
error strings; a ruleset is valid iff all return []. TDD throughout (28 red→green micro-cycles for the checks; a
`v*/` inside a block comment closed it early — caught at first run, reworded).

**`rules.json` shape (the artifact 006's loader will consume).** `prohibited_terms` (literal/word/regex scan list
w/ `severity` + `requires_substantiation` context flag — guarantee/promise/no-risk = high non-substantiable;
best/top-ranked/outperform = medium, requires substantiation) **plus a `prohibited_content` array I added** for
the §5.3 categories that aren't single-word scans (testimonials, unsubstantiated/hypothetical performance,
endorsements w/o comp disclosure, forward-looking w/o risk) — Layer-2's LLM judges these. `required_elements`
(ADV 2A/2B footer; CRS footer+page; Privacy footer+page) each carry `placement`. `required_disclosures`
(registration-no-skill, informational-only, Reg S-P) carry `template` + `text_pattern`. `conditional_rules`
encode SEC (AUM ≥ $100M) vs state (AUM < $100M, `applies_overlay:true`) per §5.5. Every rule references an id in
a `citations` map (deterministic "citation for every rule" — stronger than scanning prose).

**§5.7 publish gate enforced in code, not just convention.** `checkReviewGate`: if `manifest.review.approved`
is `true` it *requires* ≥2 `reviewers` + `published_at`/`published_by`, else lint fails. So an accidental
`approved:true` can't pass CI without a real two-person record. The ruleset ships `approved:false` (the human
gate). Acceptance #6 is therefore `[~]` (built + enforced, sign-off pending) — **second approver still TBD**, and
**counsel must verify citation URLs before publish** (titles authoritative, URLs best-effort; flagged in rules.md
+ each overlay).

**State overlays = drafts, accuracy-flagged.** 10 overlays (CA/NY/TX/FL/IL/PA/NJ/MA/GA/OH) each carry the
correct regulator name + the standard state registration footer line + a citation, with explicit "verify
state-specific requirements with counsel" notes — per the ticket's "flag, don't guess" rule. Wired into
`manifest.state_overlays`; the linter verifies each file resolves.

**Consistency with 007's frozen eval baseline:** intentional superset. `evals/baseline.ts` froze the *context-free*
§18.2 terms only (so the eval gate stays deterministic); 005's `rules.json` adds the context-dependent terms +
`prohibited_content` + full required-element set. 006's loader (not the evals) is the source of truth for *live*
Layer-2; the two are deliberately decoupled (see the 007 entry).

**5-file guardrail:** the ticket spans ~28 files across two slices (validator+tests+schema+fixtures, then the
authored ria/v1.0 artifacts + 10 overlays). Past the literal count but a single coherent deliverable ("author the
ruleset + the validator that keeps it well-formed"), built TDD-first and sliced (tooling+base ruleset → overlays).
Mostly versioned content artifacts, not logic. No DB/schema change, no new dependency.

**Green:** `npm run lint:rulesets` exit 0 on `ria/v1.0`; exit 1 + 8 errors on the malformed fixture (gate bites);
`node --test` **31/31**. No UI in this ticket, so no frontend test / preview URL applies — the runnable gate +
test suite are the handoff. **Deferred (the human gate, by design):** two-person sign-off + counsel URL
verification before `approved:true`.

---

## 2026-06-01 — 006 Layer-2 compliance validator + ruleset loader (PRD §5.2, §5.6, §8.1)

The automated compliance gate — "never ship copy that hasn't passed Layer 2." One deep module
`platform/src/lib/compliance/` (ruleset → loader → validator → persistence + index), built TDD-first.
**No migration** (002 already shipped `compliance_rulesets` + `compliance_violations`); **no new dependency**.

- **Layer 2 is a HYBRID, deliberately — deterministic backbone + additive AI pass.** PRD §5.2 frames Layer 2 as
  "a separate Gemini Flash call," but a pure-LLM gate is non-deterministic, costs money per check, untestable
  without a key, and a single prompt regression would silently disable the whole moat. So:
  - **Deterministic pass (always runs, authoritative).** Word-boundary scan for *context-free* prohibited terms
    + required-element/disclosure presence. Free, fast, offline-verifiable, immune to prompt drift — this is the
    gate's teeth and covers every ticket acceptance criterion.
  - **AI semantic pass (Gemini Flash, additive — `validator.runAiPass`).** Catches what regex can't: the
    `prohibited_content` categories (testimonials, hypothetical performance, forward-looking-without-risk) and
    *context-dependent* superlatives (best/outperform only when used as an unsubstantiated claim). It can only
    ADD violations, never remove a deterministic one. Skipped when no client is supplied, and that's **surfaced**
    via `Layer2Result.aiPassRan:false` — missing semantic coverage is never silently treated as a pass.
  This is the §8.2.2 "rulebook rides in the *system* prompt" stance taken one step further (the deterministic
  layer is independent of the prompt entirely), and it's consistent with the reasoning 007 baked into its eval
  baseline (context-free terms only in deterministic scans, to avoid false positives on "best"/"outperform").
- **Term split keyed on `requires_substantiation`.** `validateDeterministic` scans only the `prohibited_terms`
  groups where `requires_substantiation === false`; the `true` groups (superlatives) + all `prohibited_content`
  go to the AI pass. A deterministic substring gate on "best" would false-positive on legitimate copy and block
  good sites — exactly the failure mode 007 called out.
- **Pure/IO split, same as auth/orders.** `ruleset.ts` is pure (parse + resolve overlay + build prompt text);
  `loader.ts` is the fs edge (reads `compliance/{industry}/v{version}/` at `<platform-cwd>/../compliance`, dir
  injectable so the loader test runs against the **real authored ria/v1.0** and catches drift); `validator.ts`
  is pure deterministic checks + an IO seam (`Layer2Gemini`, the structural slice of `GeminiClient` — real
  client satisfies it, tests inject a stub verdict); `persistence.ts` is the DB edge (service-role).
- **`ValidationSubject` makes Layer 2 reusable across 020/029/031.** `{kind:"site"}` runs prohibited-terms +
  required-element/disclosure checks (the footer is in scope); `{kind:"fragment"}` (edit chat 029, blog 031)
  runs prohibited-terms only — a blog post is NOT the footer, so it must not fail for "missing CRS link." This
  scoping is the key correctness call that keeps the gate reusable without false-failing fragments.
- **Ruleset mirror respects 002's immutability trigger.** `mirrorRuleset` INSERTs the (industry, version) row
  once and is a **no-op if it already exists** — never an UPDATE (002's before-update trigger on
  `compliance_rulesets` blocks content edits; the on-disk artifact stays the source of truth). Stores the parsed
  typed `rules` as `rules_json` + `rules.md` as `rules_markdown` for runtime lookup (§5.6).
- **Version string = "ria/v1.0"** (`rulesetVersionString`). Carried on every `Layer2Result.rulesetVersion`,
  written to `compliance_violations.ruleset_version`, and is the value 020 writes into
  `generated_content.compliance_version_used`.
- **Registration is an explicit input, not a schema column.** SEC-vs-state is determined by AUM in onboarding
  (§5.5); `accounts` has no `registration`/AUM column yet (010/013 add it). So `resolveRuleset` takes
  `registration` as a param + reads the overlay by `primaryState`; the caller (020) supplies registration from
  intake. No schema change here.
- **Verify path is offline-complete.** `GET /api/dev/compliance-check` validates a clean fixture (→ pass/0) and a
  seeded-bad fixture ("guaranteed … no risk" + removed CRS link → fail/3) against the real ruleset. Both verified
  in-process (route.test.ts) AND live (`curl localhost:3000/api/dev/compliance-check` → the exact 3 deterministic
  violations: guarantee, no_risk, crs). `aiPassRan:false` (no key needed). Dev-gated (404 in prod), like
  gemini-check.
- **Deferred (`[~]`, consistent with 001–009/033 — no Docker/Gemini key this session):** (1) live
  `compliance_violations` DB write — `recordViolations` is unit-proven against a mock service-role client; the
  live insert + pipeline wiring lands with **020** (generation still stubbed, so nothing writes violations yet).
  (2) live Flash AI pass — wired (`runLayer2` passes a real `geminiClient()` when `GEMINI_API_KEY` is set) and
  tested against a stub boundary; activates with a dev key. **Catch-up:** set `GEMINI_API_KEY`, hit
  `/api/dev/compliance-check` → expect `aiPassRan:true` and any semantic violations merged in.

**No UI in this ticket** → no frontend test / preview URL applies; the runnable dev endpoint + test suite are the
handoff (same as 005/007/008/009).

**Green:** `npm test` **298** (+40: 10 ruleset + 5 loader + 14 validator + 7 persistence + 2 index + 2 dev route),
`npm run typecheck`, `npm run lint`, `npm run build` (the `/api/dev/compliance-check` route compiles dynamic), and
the separate `npm run evals` gate still **16/16**. **006 Done** → unblocks 020/021/029/031/034.

---

## 2026-06-05 — 010 Onboarding shell + 011 Waitlist (PRD §4.1 steps 4–6, §7.7, §15.4, §2.2)

**Context.** First slice that reaches the UI for the build pipeline — the onboarding spine that creates an
order and fires `order.created`. Built 011 (waitlist) alongside it because the industry grid needs a
functional waitlist for its four non-RIA cards. Wireframe checkpoint (Q1c) approved before build.

- **Auto-save / resume persists onto `accounts`, no progress table (owner decision).** The onboarding
  answers (`industry`, `sub_industry`) ARE the resumable state — `getOnboardingState` reads them + whether an
  order exists, and pure `resolveResumeStep` turns that into the step to render. Chosen over a dedicated
  `onboarding_progress` jsonb column for speed/simplicity at 010's two questions. **013's richer quick-questions
  may need more** (a draft store) — revisit then; this is not a permanent decision against the column.
- **Payment is a simulated placeholder, no Stripe dep (owner decision, §15.4).** `POST /api/onboarding/checkout`
  creates the order directly on "Start my site" — no `@stripe/*` package, no product/price setup. Full Stripe
  enforcement is **032** (before private beta), which swaps in real billing at this exact seam.
- **Order creation goes through the advisor's RLS-bound session, not service-role.** `orders_owner` /
  `accounts_owner` are `FOR ALL WITH CHECK owns_account`, so the signed-in advisor can insert their own order +
  update their own account. No service-role needed (unlike the admin/pipeline writes).
- **`createOrderAndEnqueue` is idempotent on double-submit.** v1 is one website per account, so if any order
  already exists for the account it returns that one without a second insert or re-emit (`service.test.ts`).
- **Deps injected (client + userId + send), production wrapper `resolveOnboardingDeps`.** Same pattern as
  `lib/admin/orders.ts` — routes build deps from the cookie-bound server client + real Inngest sender; tests
  inject stubs. Keeps the IO unit-tested without Docker.
- **011 waitlist: public-insert RLS policy + dedup index (migration `20260605120000`).** The core-schema RLS
  file explicitly deferred the waitlist public-insert policy to 011. Added `for insert to anon, authenticated
  with check (true)` (no SELECT policy — list stays service-role-only for 036's /admin/leads) + a
  `unique (email, industry)` index so the `ignoreDuplicates` upsert is a true no-op. Emails normalized to
  lowercase in the service before insert so casing collapses. This migration is separate from and does not
  contradict the "no migration for onboarding auto-save" decision above.
- **`/onboarding` is its own full-screen segment (concierge canvas), not under the dashboard shell.** Wrapped
  only by the root layout; clean single-column flow, no sidebar. Auth-gated by the existing middleware (not in
  `PUBLIC_PATHS`). The waitlist API is reachable signed-out because API routes self-gate in middleware.

**Deferred (`[~]`).** (1) **Emailed magic-link** for "Save & continue later" → lands with **004** (Resend); the
*resume capability* itself works fully today (server-derived from the persisted account — an authed advisor
returns to `/onboarding` and resumes exactly). (2) **Skip-with-default affordance** → none of 010's three steps
is a genuinely-optional question, so the visible skip first appears with **013**'s optional quick-questions; the
save-before-advance mechanism + `validateSubClass` default are in place. (3) **Live DB** insert/update + live
`order.created` round-trip (no Docker/Inngest this session, same as 001–009) — all contracts unit-proven against
stubs. **Entry-point wiring** (post-verify redirect to `/onboarding` when no order) intentionally left to the
onboarding-completion follow-up; `/onboarding` is reachable directly today.

**Visual QA** (chrome-devtools temp preview `preview-onboarding`, fully torn down + middleware allowance removed):
**Lighthouse a11y 100 / best-practices 100** (desktop), console clean, 375 + 1280px — industry / sub-class /
payment / handoff screens all verified; mobile single-column stack confirmed.

**Green:** `npm test` **334** (+36: 13 steps + 6 waitlist-validate + 9 onboarding-service + 3 waitlist-service +
5 flow frontend), `npm run typecheck`, `npm run lint`, `npm run build` (`/onboarding` + 3 API routes compile
dynamic). **010 + 011 Done.** 010 unblocks **012** (scrape/intake) → the AI pipeline; also **013, 015**.

## 2026-06-05 — 012 Scrape (Firecrawl) + intake.process + docs-upload fallback (PRD §4.1 step 7, §4.2, §4.3, §8.3, §9.2)

The two pipeline stubs `scrape` + `intake` (009) are now real work. New deep module `lib/intake/`
(sufficiency → scrape → docs → extraction → upload) + a `lib/firecrawl/` client; the Gemini layer (008)
grew an `intake` use case + multimodal file parts. Owner decisions front-loaded (the two AskUserQuestion
forks): **doc extraction = Gemini-native PDF + local parsers (mammoth/jszip) for DOCX/PPTX**; **upload
surface = API + storage now, advisor-facing upload UI deferred to 013** (013 owns the round-1/round-2/assets
screen, so building it here would be thrown away).

- **Firecrawl via a thin fetch boundary, NOT the SDK.** `FirecrawlClient(http, apiKey)` injects a `fetch`-like
  `HttpBoundary` (no new dependency — `fetch` is built-in). Client owns the v1 async crawl flow (POST start →
  poll status) with an injected `sleep` so tests run instantly. We **crawl** (multi-page), not single-page
  scrape, because the §4.3 sufficiency check needs page count to tell a real site from a one-pager/SPA.
- **Rate-limit vs hard-failure split (CLAUDE.md fallback policy).** A 429 → `FirecrawlRateLimitError` (carries
  the duck-typed `isRateLimit`/`service`/`endpoint` markers `lib/inngest/errors.ts#isRateLimitError` already
  recognises) → **rethrown**, so the pipeline logs to `state/rate-limits.md` and Inngest backs off + retries
  (NOT docs-fallback). A hard failure (anti-bot/5xx/job `failed`) → `FirecrawlError` → **docs-upload fallback**
  (§4.3). Insufficient content (single-page/blocked/thin) also → fallback. Distinct paths, both tested.
- **Sufficiency is a pure, named-threshold check (`isContentSufficient`, §4.3).** ≥2 content-bearing pages
  (≥200 chars each) and ≥600 total chars, else `{no_pages|single_page|insufficient_text}`. Reason feeds the
  soft-failure event. Thresholds are tunable constants (alpha).
- **Soft-failure event = the `scrape_failed` transition's note** (order_state_events, 033). The pipeline routes
  `scraping → scrape_failed (note: "docs-upload fallback: <reason>") → docs_upload_fallback`; both the §4.2
  no-site path (`no_url`) and §4.3 failures share this branch (the state machine only exits `scraping` via
  `scrape_complete | scrape_failed`). The `scrape_failed` name is slightly off for the deliberate no-site case,
  but its only legal exit is `docs_upload_fallback`, which is exactly the destination — acceptable for v1.
  Added an optional `note` param to `transitionOrder` for this.
- **Doc extraction strategy (owner-decided).** TXT/MD decoded inline; **DOCX via `mammoth`**, **PPTX via `jszip`
  + `<a:t>` run regex** (both in-memory, no temp files — chosen over `officeparser` to avoid fs/temp-file
  behavior and keep parsing unit-testable); **PDF handed to Gemini natively** as an inline file part (better
  than a text-layer scrape; scanned PDFs have no text layer). New deps: `mammoth@1.12`, `jszip@3.10` (the 3
  pre-existing `npm audit` moderates are postcss/next, unrelated). v1 is **text-only** — no image extraction
  from docs (§4.2).
- **GeminiClient gained inline file parts** (`files?: GeminiFilePart[]`): with files it builds a `{role,parts}`
  contents array (text + `inlineData`), else keeps the bare-string form (back-compat, tested). **Caveat:**
  pre-flight input-token counting is text-only, so PDF tokens are billed/recorded post-call from
  `usageMetadata` — documented in `budgets.ts`. New `intake` use case → **Flash** (extraction is comprehension,
  not creative generation — cheap, keeps the $2/site guard happy) + new `intake_extraction` operation budget
  (NOT in the §8.4 table; generous 120k input cap because a whole-site scrape is large, small output).
- **Round-1 schema (§8.3) is lenient-parse.** Every field is `{value, confidence (0–1), sources[]}`; `parse`
  throws only on a non-object (so the repair loop re-prompts) and otherwise coerces each field, defaulting
  missing/garbled ones to `{null, 0, []}`. "Not found" is confidence 0, not a failure — this feeds 013's
  confirm-or-correct UI. Brand colors extracted here too (feed 015 previews / voice).
- **New migration `20260605130000_intake_scrape_docs.sql`:** `unique (order_id)` on `intake_data` (the
  "one intake per order" invariant the codebase already assumed — lets scrape/intake/upload **upsert**
  idempotently under Inngest retries) + a **private `intake-docs` Storage bucket** (uploads are server-side via
  service-role, which bypasses Storage RLS, so no per-object policy; private because brochures may carry PII).
  No column change → `database.types.ts` unchanged. Seed gains an `intake_data` row (URL) for the verify path.
- **Upload route ownership model.** `POST /api/onboarding/docs` (multipart) authenticates + resolves the
  advisor's order through the **cookie-bound RLS client** (only returns rows they own), then writes via the
  **service-role admin client** (private bucket). Logic lives in `uploadDocsForUser` (unit-tested) so the route
  is thin glue. Validates all 5 formats + 25MB/file cap; appends (dedupes) onto `uploaded_doc_paths`.
- **Fixed a latent 009 bug while here:** the stub used the *stage* as the Inngest step id, so a stage advancing
  through several states reused one id — real Inngest memoises same-id steps and would silently skip the later
  transitions. `advance` now uses `${stage}:${to}` (unique per transition). No behavior change in tests; makes
  the whole pipeline correct under real Inngest. `runPipeline` now injects `scrape`/`intake` (default to the
  real bodies) so tests drive it without live Firecrawl/Gemini/Storage.

**Deferred (`[~]`).** (1) **Live external runs** — a real Firecrawl crawl, a live Gemini extraction, a real
Storage write, and the end-to-end Inngest pipeline — all need API keys + Docker/Inngest dev not available this
session (same constraint as 001–009); every contract is unit-proven against injected stubs/fixtures, and the
seed + slim step output make the live round-trip a key-only follow-up. (2) **The advisor-facing §4.3 message +
upload screen** land in **013** (this ticket records the soft-failure reason + exposes the upload API the UI
calls). (3) **Scrape-content truncation for pathological huge sites** — we fail loud at the 120k input cap
(§8.2.7) rather than silently truncate; revisit in alpha if real RIA sites trip it.

**Green:** `npm test` **389** (+55: gemini files/budget/model, firecrawl 7, sufficiency 6, scrape 6, docs 7,
upload 9, schema 7, extraction 4, upload-service 3, pipeline branch 2), `npm run typecheck`, `npm run lint`,
`npm run build` (`/api/onboarding/docs` compiles dynamic). **012 Done — unblocks 013 + 020** (020 still needs
**016**). No UI in 012 → no preview URL; verify locally per the catch-up commands once keys/Docker are present.

---

## 2026-07-05 · Ticket consolidation (re-ticketing pass)

**Context.** The CLAUDE.md scope guardrail was raised from "more than 5 files → stop and split" to
"more than 12 files." The old 5-file ceiling had forced several features to be split into two tickets
that were really one vertical slice (generate + review; shared-lib + reference template; etc.). With the
higher ceiling, the remaining (not-done) tickets were re-run through `skills/vertical-slice-kanban.md`.

**Choice.** Consolidated the **24 remaining tickets → 16**. Done tickets (001–003, 005–012, 00A, 027, 033)
were left untouched — reworking them would destroy completed-acceptance provenance for no benefit.

Merge map (target ← merged-away):
- **013** ← 015  (template selection is the last screen of the same intake flow)
- **016** ← 017  (Trust is the reference render that proves the shared lib — already the Q2b anchor pair)
- **018** ← 019  (Modern + Boutique: identical shape, both inherit the anchor bar AFK)
- **020** ← 021  (generate → preview → revise(≤3) → approve is one vertical slice)
- **022** ← 023  (images + legal/hygiene pages: the two secondary-content producers, both block 024)
- **024** ← 025, 026  (build → deploy → launch → DNS monitor: the whole pipeline tail)
- **034** ← 036  (Layer-3/violations + read-only observability: the rest of the admin console)

**Aggressiveness.** Owner chose the "more aggressive" option (24 → 16) over the conservative (24 → 21)
and the natural-pairings-only (24 → 18) variants — explicitly accepting that **024** exceeds the 12-file
guideline. Mitigation: 024 is written with three ordered, independently-verifiable sub-slices (A build+GitHub,
B Vercel deploy+launch, C DNS monitor cron) and a note to land them as separate commits rather than one push.

**Cross-reference cleanup.** Remapped all `Blocks` / `Blocked by` header fields and forward-looking body
prose across surviving tickets (done + remaining) to point only at surviving IDs. plan.md DAG, "Unblocked
right now," and "Blocked" sections rewritten to the 16-ticket shape. Critical path is now 016 → 020 → 024 →
(029, 032). Unblocked now: 004, 013, 014, 016, 022, 035, 037.
