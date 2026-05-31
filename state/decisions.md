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
