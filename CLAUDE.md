# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# Agent Instructions — Base

You are a pair programmer. You handle reasoning and decisions; I review and steer.

**Start of every session:** Read `state/plan.md` to pick up where we left off, then scan `issues/` for tickets in flight.
**End of every task:** Update `state/plan.md`. Append non-obvious decisions to `state/decisions.md`.
**Committing state:** Bundle state updates into the same commit as the code change they describe. Never commit state alone.

---

## Project Context — What We're Building

**WRI (Website for Regulatory Industries)** is a done-for-you website generator for solo and small-firm regulated professionals. v1 targets only SEC-registered and state-registered RIAs (financial advisors). An advisor signs up, pays $50/mo, and within ~15 minutes gets a hosted, compliance-aware website — either rebuilt from their existing site (scraped) or generated from uploaded documents. WRI handles scraping, copy generation, compliance validation, template assembly, per-customer GitHub repo, Vercel deployment, and DNS handoff. Post-launch edits happen through a chat interface that re-runs compliance validation on every change. Read `WRI_PRD_v1.0.md` for the full spec; Section 4 ("User Journeys & Flows") is the fastest way to understand the end-to-end loop. **The PRD is the source of truth — never infer product behavior, pull it from there.**

The architecture that takes multiple PRD sections to piece together:

- **Two product surfaces, one quality standard.** WRI is two products under one roof: the **platform** (advisor dashboard, onboarding flow, `/admin` tools, edit chat) and the **generated customer sites** (three Astro templates). Both must meet §7's UI/UX bar. Platform = Next.js on Vercel; generated sites = Astro + Tailwind on per-customer Vercel projects.
- **Compliance is the moat — three-layer engine.** Layer 1 (prevention): the active ruleset is injected into Gemini's system prompt so generation operates within constraints. Layer 2 (validation): a separate Gemini Flash pass scans output for prohibited terms and required disclosures. Layer 3 (manual gate): WRI team review for the first 50 sites and for any site flagged by Layer 2. Rulesets are versioned per industry/sub-industry; every generated piece records which version it was built against.
- **Long work runs in Inngest, not Vercel functions.** Vercel functions cap at 90–120s; scrape + generate + build + deploy easily exceeds that. The pipeline is modeled as Inngest steps (scrape → extract → IAPD fetch → generate → validate → build → deploy → notify), each with its own retry policy. The platform Next.js API just enqueues jobs.
- **One account = one website in v1.** Single customer site per account; one GitHub repo (under WRI's org); one Vercel project; one custom domain (apex + www, advisor-owned, advisor manages DNS at their registrar). Content is fully versioned in Postgres — every edit creates a new `generated_content` version, never destructive update.
- **Order state machine.** Every build progresses through a defined state machine (PRD Appendix 18.1). Failures escalate to `/admin/orders` with one-click retry. Layer 3 manual review is a state in the machine, not an out-of-band process.

**v1 scope is deliberately hard-bounded** — do not pre-build deferred items (PRD §3.2 and §17 list them). Locked for v1: RIA only (no insurance, mortgage, law, real estate); SEC and state-registered RIAs only (no BD-affiliated, no FINRA Rule 2210 pre-approval flow); one account = one website; one user per account; no template switching after deploy; no AI-generated people in images, ever; no analytics dashboard; no native scheduling/CRM integrations beyond a Cal.com link; US-only, English-only.

---

## Current State of the Repo

(To be updated by ticket 001 once the repo is scaffolded.)

- **Start of session:** read `state/plan.md`, then pick the lowest-ID **unblocked** ticket in `issues/` (every "Blocked by" ticket is Done).
- **Stack (locked, see `state/decisions.md`):**
  - **Platform:** Next.js (App Router) + TypeScript on Vercel
  - **Database + Auth + Storage:** Supabase (Postgres + Auth + Storage in one)
  - **Background jobs:** Inngest
  - **Email:** Resend (transactional + lead notifications)
  - **Scraping:** Firecrawl
  - **Component library:** shadcn/ui on Radix + Tailwind (per PRD §7.5 — single-library, copy-into-codebase)
  - **Icons:** Lucide
  - **AI:** Gemini 2.5 Pro (generation), Gemini 2.5 Flash (validation + edit chat), Gemini 2.5 Flash Image (capped image generation)
  - **Customer site stack:** Astro + Tailwind, one GitHub repo + one Vercel project per customer
  - **Customer GitHub access:** via GitHub App (never PAT)
  - **Customer Vercel deploys:** via Vercel API per project
  - **Payment:** Stripe (subscription billing; placeholder during alpha)
  - **Spam:** Cloudflare Turnstile on every customer contact form
  - **Front-end visual QA:** `chrome-devtools` MCP server (Google Chrome DevTools team), registered in `.mcp.json`, self-launching headless Chrome — the agent's visual feedback loop for UI work (see `skills/frontend-visual-qa.md`). Distinct from committed `npm test` frontend tests (Playwright/Vitest browser mode), which remain required.
- **API contract:** every response is the `{data,error}` envelope, enforced centrally in the platform API layer. Return payloads; raise `AppError` for expected failures. Never hand-build the envelope.
- **Schema source of truth = Supabase migrations.** Tests build the schema from migrations, never `create_all`-equivalents.
- **Compliance rulesets** live under `compliance/{industry}/v{version}/` as paired `rules.json` (machine-readable) + `rules.md` (human-readable, with citations). They are versioned artifacts in the repo, not DB rows — DB only records which version a given site was built against.

---

## Build / Test / Run

Platform (run from `platform/`):

| Task | Command |
|---|---|
| Install deps | `npm install` |
| Run app (dev) | `npm run dev` |
| Run Inngest dev server | `npx inngest-cli@latest dev` (separate terminal) |
| All tests | `npm test` (single: `npm test -- src/path.test.ts -t "name"`) |
| Lint / typecheck | `npm run lint` · `npm run typecheck` |
| Build | `npm run build` |
| Migrate (Supabase) | `npx supabase migration new <name>` · `npx supabase db push` |
| Regenerate DB types | `npm run gen:types` (re-run after any migration) |

Astro templates (run from `templates/{trust|modern|boutique}/`):

| Task | Command |
|---|---|
| Install deps | `npm install` |
| Run template (dev) | `npm run dev` |
| Build | `npm run build` |
| Lighthouse check | `npm run lighthouse` (must pass §6.10 thresholds before merge) |
| Accessibility check | `npm run a11y` (axe-core; must pass WCAG 2.1 AA) |

Compliance ruleset (run from `compliance/`):

| Task | Command |
|---|---|
| Validate ruleset JSON | `npm run lint:rulesets` |
| Run prompt evals | `npm run evals` (golden test cases must pass before any prompt change merges) |

---

## Reference Documents

Read these when relevant. Never assume — pull from source.

| Doc | What's in it |
|-----|-------------|
| `state/plan.md` | Project-level status — done, in progress, blocked |
| `state/decisions.md` | Append-only log of architectural choices |
| `state/rate-limits.md` | API rate limit log — thresholds, observed errors, fallback per service |
| `issues/` | One file per ticket. Each ticket is a vertical slice with declared blockers. |
| `WRI_PRD_v1.0.md` | **Source of truth for all product behavior.** §1–3 vision/positioning/scope · §4 end-to-end flows · §5 compliance framework · §6 templates and generated-site spec · §7 UI/UX standards (mandatory before any UI work) · §8 AI strategy · §9 system architecture · §10 data model · §11–12 admin and customer dashboard scopes · §13 operations · §16 launch sequence · §17 explicitly out-of-scope · Appendix 18.1 order state machine. |
| `compliance/ria/v{N}/rules.md` | The active RIA compliance ruleset. Read before any work touching copy generation, validation, or footer disclosures. |

---

## Skills

Load the relevant skill before starting work in that area. Do **not** pre-load them.

| Skill | When to use |
|-------|-------------|
| `skills/vertical-slice-kanban.md` | Right after the PRD is settled — convert it into independently grabbable `issues/` tickets. The first thing to run on this repo. |
| `skills/deep-modules.md` | Before creating new files for a feature, or when proposing how to split/merge code. Output a module map first. |
| `skills/tdd.md` | Before implementing any non-trivial logic, validation, calculation, or state transition. One failing test at a time. |
| `skills/code-review.md` | After an implementation session has commits ready — **in a fresh context only**, never the same session that wrote the code. |
| `skills/frontend-design.md` | Before any new screen, dashboard view, or visual change — even small ones. Mandatory for advisor-facing UI and the three customer templates. Produces distinctive, non-generic interfaces and enforces PRD §7 standards. |
| `skills/frontend-visual-qa.md` | After building or changing any UI (platform screens or the three templates) — to actually *look* at the rendered result through a real headless Chrome: dark mode, responsiveness, Lighthouse (§6.10), accessibility (§7), console/network. This is the visual feedback loop, **not** the committed automated test (build loop step 8 requires both). |

---

## How I Like Work Done

### Plans are kanban DAGs, not sequential phases
The plan is the collection of tickets in `issues/`. Each ticket declares what it **blocks** and what **blocks it**. There are no numbered phases — there is only "what is currently unblocked." When multiple tickets are unblocked simultaneously, they can be worked in parallel by separate agents.

Every ticket must declare:
- **Slice description** — what changes across the stack (schema, service, endpoint, UI)
- **Blocks** — ticket IDs that depend on this one
- **Blocked by** — ticket IDs this depends on
- **Type** — `AFK` (agent can complete unattended) or `human-in-loop` (needs my input mid-work)
- **Acceptance** — how I'll know it's done

When picking the next ticket, prioritize: critical bug fixes → development infrastructure (broken tests, slow feedback loops) → unblocked feature tickets (prefer those that unblock the most downstream work) → polish.

### Vertical slices, not horizontal layers
Every ticket is a thin slice through the stack that produces something visible and testable end-to-end. Do not batch all schema work, then all API work, then all UI. The first slice of any feature must reach the UI — even minimally — so I can see and verify it.

### TDD: red, green, refactor
For any non-trivial logic, write the failing test first, confirm red, implement until green, refactor. Do not write the implementation first and bolt tests on after — they almost always cheat.

### Deep modules over shallow ones
Prefer few modules with simple external interfaces and substantial internals over many small modules with thin interfaces. Before creating new files, state the **module map**: what each module exposes, what it depends on. Then write code.

### Feedback loops are the ceiling
After every meaningful change, run tests, types, and lint. If a feedback loop is missing or slow, fix the loop before continuing. The quality of your output is capped by the quality of your feedback.

### Clear, don't compact
When context fills up, prefer clearing and re-entering with fresh state over compacting. Compacted history accumulates noise that degrades later reasoning.

### Review in a fresh context
Implementation and review do not happen in the same session. Implement, commit, clear, then review.

### Keep tickets small enough to think clearly
If a single ticket will fill the context window, split it. Smaller scope → better decisions.

### Questions carry business impact, not just tech
Whenever you ask me to make a decision, frame both sides:
- **Technical implication** — what changes in the code, architecture, or flow.
- **Business implication** — how it affects the advisor's experience, conversion/completion rate, churn, compliance/legal exposure, per-site cost, launch velocity, or support burden — i.e. *how the product or the flow will actually change, for whom, and what it costs or risks.*

State the trade-off, recommend an option when you have one, and let me answer by number. Never surface a purely technical choice as if it had no business consequence — if it genuinely doesn't, say so. This applies to `human-in-loop` tickets especially: the point of every question is to front-load enough context that the ticket can then run **AFK**.

### Every push gives me something to test — a frontend test + a live URL
Any change that touches UI (platform screens **or** the three customer templates) must hand me two things on every push, in the push/PR summary:
- **A frontend test** — an automated UI test that exercises the actual rendered behavior of the change (component or end-to-end, e.g. Playwright / Vitest browser mode), wired into `npm test`. Not just unit tests on the logic underneath — the thing I'd click, clicked by a test. If no frontend-test harness exists yet, set one up as part of the first UI ticket (note it in `state/decisions.md` per the dependency guardrail).
- **A live URL I can click** — a Vercel **preview deployment** URL for the platform, or the deployed/preview template, that I can open and test by hand. If a change genuinely can't produce a preview URL, say why and give me the exact local command + route to see it (`npm run dev` → `/path`).

No "it works, trust me." If I can't click it and a test doesn't cover it, it isn't done.

---

## Build Loop (per slice)

1. Read the ticket in `issues/`.
2. **Schema** if needed (Supabase migration).
3. **Service** — business logic in the Next.js API layer or as an Inngest step.
4. **Test endpoint** — verify with curl (or equivalent) before any UI.
5. **UI** — wire to the verified backend. Load `skills/frontend-design.md` before touching screens.
6. **Compliance check (where relevant)** — if the slice touches generated copy or customer-facing site content, run the Layer 2 validator manually before declaring done.
7. **End-to-end verification** — user action → DB → back.
8. **Test handoff (UI changes)** — two distinct, both-required deliverables (don't let one stand in for the other):
   - **(a) Visual QA loop, before declaring done** — load `skills/frontend-visual-qa.md` and drive the `chrome-devtools` MCP (headless Chrome) over the rendered change: dark mode, responsiveness, Lighthouse (§6.10), accessibility (§7), console/network. This is *your* feedback loop, not a handoff artifact.
   - **(b) Handoff** — ship a **frontend test** (component/e2e, part of `npm test`) covering the change, **plus a live preview URL** I can click (Vercel preview deploy; or the local `npm run dev` route if no preview is possible). Put the URL in the push summary. The MCP browser in (a) does **not** satisfy this — it leaves nothing I can re-run.
9. Move ticket to done. Update `state/plan.md`. **Tick every `[ ]` → `[x]` in the ticket file's `## Acceptance` section** — only if the criterion was actually met (cite the test or behavior that proves it in the commit message if not obvious). If a criterion was deliberately deferred or descoped, mark it `[~]` and say so in `state/decisions.md`. Note anything learned.

All API responses follow this shape:
```json
{ "data": { ... }, "error": null }
{ "data": null, "error": { "message": "...", "code": "..." } }
```

---

## Rate Limits & Fallbacks

When any external API (Gemini, Firecrawl, Vercel, GitHub, Resend, Stripe, SEC IAPD) returns a rate-limit error:

1. **Log to `state/rate-limits.md`** — service, endpoint, limit hit, timestamp, error code.
2. **Trigger the documented fallback** for that service:
   - **Firecrawl rate limit or insufficient content:** fall through to docs-upload flow (PRD §4.3).
   - **Gemini rate limit:** Inngest backoff + retry; surface "preparing" state to user.
   - **Vercel API rate limit:** Inngest backoff + retry; deploy state stays "deploying."
   - **GitHub API rate limit:** Inngest backoff + retry; auto-resume — never block on this.
   - **SEC IAPD unavailable:** fall back to scrape, then to direct upload (PRD §5.4).
   - **Resend bounce/complaint:** log to `email_log`, surface in `/admin/email-log`, do not retry blindly.

Never surface a raw API error to the user. Queue and retry, or route to the fallback. If no fallback exists, show a non-alarming "preparing…" state and resolve async.

---

## Guardrails (Hard Stops)

- **Cost** — Gemini calls cost real money. Per-site generation target: under $2. If a change would push past this, stop and confirm.
- **Compliance** — Never ship copy or a template change that hasn't passed Layer 2 validation. If working in `compliance/`, never publish a ruleset without two-person review (PRD §5.7).
- **AI images** — Hard prohibition on AI-generated people, hands holding documents, or anything resembling client/advisor likenesses (PRD §6.7). This is a compliance rule, not a stylistic preference.
- **Scope** — If a change touches more than 12 files, stop and break it into smaller steps.
- **Rollback** — If something breaks after a change, revert before trying a different fix.
- **Destructive** — Before deleting, overwriting, or restructuring existing files, confirm. Customer GitHub repos and Vercel projects are *especially* destructive surfaces — archive, never delete (PRD §4.6 — 90-day archive on cancellation).
- **Dependency** — Before adding a package, state what it does and why existing tools don't cover it. We are committed to shadcn/ui + Tailwind + Lucide; new UI libraries require explicit decision in `state/decisions.md`.
- **Doc rot** — Do not delete the PRD or compliance rulesets — they are long-lived specs. But mark deferred items as resolved in `state/decisions.md` once they ship.

---

## State & Issue Files

All live inside the repo. Fully versioned.

```
state/
├── plan.md         # Project-level status. Read first, update always.
├── decisions.md    # Append-only. Date, context, choice, why.
├── rate-limits.md  # Append-only. Service, endpoint, limit, timestamp, fallback.

issues/
├── 001-<slug>.md   # One ticket per file. Vertical slice + blockers + type.
├── 002-<slug>.md
└── ...

compliance/
├── ria/
│   └── v1.0/
│       ├── manifest.json
│       ├── rules.json
│       ├── rules.md
│       └── disclosures/
└── ...
```

---

## Bottom Line

Plans are DAGs, not phases. Pick what's unblocked. Build vertical slices with TDD. Keep modules deep. Run feedback loops. Clear context between sessions. Update the plan. **Compliance is the moat — never ship copy that hasn't been validated.**
