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
