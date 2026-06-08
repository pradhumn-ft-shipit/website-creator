# Project Plan — WRI (Website for Regulatory Industries)

> Read first at the start of every session. Update at the end of every task.
> The plan is the collection of tickets in `issues/`. This file is the at-a-glance DAG + status.
> There are no phases — only "what is currently unblocked." Pick the lowest-ID unblocked ticket.

## Status: 012 Scrape + intake.process + docs-upload fallback DONE — the AI pipeline now does real work; **013 + (with 016) 020 next**

012 landed (2026-06-05). The `scrape` + `intake` pipeline stubs are now real: new `lib/firecrawl/` (fetch-boundary
crawl client) + `lib/intake/` (sufficiency → scrape → docs → extraction → upload). Firecrawl crawl → §4.3
sufficiency check → either `scrape_complete` (proceed) or `scrape_failed → docs_upload_fallback` (no-site / blocked
/ thin), soft-failure reason recorded as the transition note. `intake.process` runs Gemini (Flash, new `intake`
use case) over scrape + uploaded docs → `structured_intake_json` (Round-1 §8.3 fields with confidence + sources +
brand colors). Docs: TXT/MD inline, **DOCX via mammoth**, **PPTX via jszip**, **PDF native to Gemini** (file parts
added to 008's client). `POST /api/onboarding/docs` (private `intake-docs` bucket, RLS ownership + service-role
write). Migration `20260605130000` (unique `order_id` + bucket). Fixed a latent 009 step-id collision bug
(`${stage}:${to}`). **389 tests** (+55), typecheck/lint/build green. _Live Firecrawl/Gemini/Storage/Inngest runs
deferred (keys + Docker); advisor-facing upload UI + §4.3 message → 013._ See decisions.md (2026-06-05 · 012).

<details><summary>prior status — 010 + 011</summary>

### 010 Onboarding shell + 011 Waitlist DONE — first UI slice of the build pipeline

010 + 011 just landed (2026-06-05). The onboarding spine (`/onboarding`): industry pick → sub-class confirm →
simulated $50/mo checkout (§15.4 placeholder, no Stripe dep) → creates the `orders` row + fires `order.created`
→ build-handoff screen. One-question-at-a-time shell with progress rail, Back/Next, **auto-save onto `accounts`**
(no progress table — owner decision), resume-derived step (`resolveResumeStep`), non-blocking handoff indicator.
**011 folded in:** the four non-RIA cards expand an inline waitlist capture (`POST /api/waitlist`, public anon
insert via new RLS policy + dedup index, migration `20260605120000`). New deep modules `lib/onboarding/`
(pure `steps.ts` + IO `service.ts`) + `lib/waitlist/`. **334 tests** (+36), typecheck/lint/build green, visual-QA
a11y 100 / bp 100 (temp preview torn down). _Emailed magic-link → 004; skip-with-default affordance → 013; live
DB round-trip deferred (no Docker)._ **012 (⊣ 008✓,009✓,010✓) is now fully unblocked** — the AI pipeline starts.

</details>

## Status (prior): 006 Layer-2 validator + ruleset loader DONE — the compliance gate is live; unblocks 020/021/029/031/034

001–003, 00A, 027 (both slices), 005, 007, 008, 009, 033 done. **006 just landed:** the Layer-2 compliance gate
(`platform/src/lib/compliance/`) — a **hybrid** validator (deterministic word-boundary + required-element backbone
that's the gate's teeth, plus an *additive* Gemini-Flash semantic pass) + a ruleset loader that reads the authored
`compliance/ria/v1.0` artifacts, applies the state overlay by `primary_state`, and mirrors the version into
`compliance_rulesets`. Reusable across surfaces via `ValidationSubject` (site vs. fragment). Verified offline +
live: `GET /api/dev/compliance-check` → clean fixture pass/0, seeded-bad fail/3 (guarantee + no_risk + missing CRS).
298 tests (+40), no migration, no new dep. **020/021/029/031/034 now clear their 006 dependency.**

005 (both slices): the authored
`compliance/ria/v1.0` RIA ruleset (prohibited terms + content, required elements/disclosures w/ placement,
SEC-vs-state conditional rules, 10 state overlays, citations) **+** a zero-dependency `lint:rulesets` validator
(`compliance/` workspace, 31 `node --test` cases). Gate proven both ways: exit 0 on `ria/v1.0`, exit 1 + 8 errors
on a malformed fixture. Ships `approved:false` — the only open part is the human §5.7 two-person sign-off (+ counsel
URL verification), which the linter now *enforces* (blocks `approved:true` without ≥2 reviewers). **006 (Layer-2
validator) is now fully unblocked** (002✓, 005✓, 008✓).

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
- **005** RIA v1.0 compliance ruleset + `lint:rulesets` (§5.3, §5.6, §18.2) `[AFK build · 2-person sign-off gate]` ⊣ 001 — **DONE (build); sign-off pending**
- **007** Prompt harness + eval harness (§8.2, §8.6) `[AFK]` ⊣ 001, 008
- **008** Gemini client wrapper + cost guard (§8.1, §8.4) `[AFK]` ⊣ 001
- **009** Inngest setup + order state machine (§9.2, §18.1) `[AFK]` ⊣ 001, 002

### Compliance engine (the moat — PRD §5)
- **006** Layer-2 validator + ruleset loader `[AFK]` ⊣ 002✓, 005✓, 008✓ — **DONE** · → 020, 021, 029, 031, 034

### AI pipeline (Inngest steps — §9.2, §18.1)
- **012** Scrape (Firecrawl) + intake.process + docs-upload fallback (§4.2, §4.3) `[AFK]` ⊣ 008✓, 009✓, 010✓ — **UNBLOCKED (next critical-path pick)**
- **014** SEC IAPD auto-pull step (§5.4) `[AFK]` ⊣ 002, 009
- **020** Generation: full-site copy, Layer-1 → `generated_content` (§8) `[AFK]` ⊣ 006, 007, 008, 009, 012, 016
- **022** Image strategy: stock search + capped AI images (§6.7) `[AFK]` ⊣ 008, 009
- **023** Generated-site legal pages: privacy/ToS/404 (§6.9, §14.1) `[AFK]` ⊣ 002, 005
- **024** Build assembly + GitHub repo create/push (GitHub App) (§9.5) `[AFK]` ⊣ 016, 017, 018, 019, 020, 023, 009
- **025** Vercel deploy + verify + DNS fetch + launch email + MX check (§9.6, §9.7) `[AFK]` ⊣ 024, 004
- **026** DNS propagation monitor cron (7d) + success email (§4.1.18) `[AFK]` ⊣ 025

### Onboarding (§4.1, §7.7, §8.3)
- **010** Onboarding shell + industry/sub-class + payment placeholder + order create `[HIL: wireframe checkpoint]` ⊣ 003, 009 — **DONE** · → 012, 013, 015
- **011** Waitlist capture (4 non-RIA industries) (§2.2) `[AFK]` ⊣ 001, 002 — **DONE** (built with 010)
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
- **033** `/admin/orders` + state history + one-click retry `[AFK]` ⊣ 009, 002, 003 — **DONE**
  (S1: gate + queue + retry; S2: detail view + `order_state_events` history)
- **034** Layer-3 review queue + `/admin/compliance/violations` (§5.2, §11.3) `[AFK]` ⊣ 033, 006, 020 · _Q4c: 009 gating → flagged-only_
- **035** `/admin/compliance` ruleset mgmt + research agent + publish + re-validate (§5.7) `[AFK]` ⊣ 006, 033
- **036** `/admin/leads` + `/admin/email-log` + `/admin/health` (§11.4–§11.5, §13.6) `[AFK]` ⊣ 033, 028, 004

### Platform legal (§14.2)
- **037** Platform ToS / Privacy / DPA `[AFK build · counsel gate]` ⊣ 001 (external: legal counsel before private beta)

## Unblocked right now

- **012** Scrape (Firecrawl) + intake.process + docs-upload fallback (⊣ 008✓, 009✓, **010✓**) — **now fully
  unblocked.** This is the next critical-path pick: it's the first real Inngest pipeline step and the last
  hard blocker (with 016) on **020** generation. **Highest-leverage pick.**
- **016** Template shared lib (⊣ 005✓, 001✓) — the other 020 blocker; AFK, parallelizable with 012.
- **004** Email infra (Resend), **037** Platform legal — standalone, still unblocked (004 needs a live Resend
  domain to satisfy acceptance; 037 carries a counsel gate).
- **006 done** → **020** generation (⊣ 006✓, 007✓, 008✓, 009✓, 012, 016) now needs only **012 + 016**;
  **029** edit chat, **031** blog, **034** Layer-3 queue each clear their 006 dependency (each still gated by
  its own other blockers). 006 ships the reusable `runLayer2(...)` + `validateContent(...)` + the ruleset
  loader/mirror + `recordViolations`.
- **007 done** (⊣ 001, 008 — both done): supplies `GENERATED_SITE_SCHEMA` + `prompts/v1` + the eval gate to **020**.
- **Next best picks (pure AFK):** with 006 done, the moat-side leverage now flows through **012** (scrape+intake)
  and **016** (template shared lib) — the last two blockers on **020** (generation). Also standalone: **004**
  (email — needs a live Resend key+domain), **011** (waitlist — fully verifiable), **037** (counsel gate).
- **009 done** unblocks **033** /admin/orders (done) and **010** Onboarding (⊣ 003, 009 — unblocked, light
  wireframe checkpoint). Hard blocker cleared for 012/014/020/022/024/025/026.
- **Next best picks (pure AFK):** **006** (Layer-2 validator — highest downstream leverage now 005 landed),
  then **004** (email — 025/028/032/036; needs a live Resend key+domain to satisfy acceptance, so pick alongside
  the domain prereq) and **011** (waitlist — standalone, fully verifiable). 037 carries a counsel gate.
- **003 done** unblocked: **027** Dashboard shell (✓ Slice 1 built), **033** /admin/orders (also 009),
  **010** Onboarding (also 009), **032** Billing (also 004, 025).
- **027 done (both slices)** — the dashboard shell + nav + Site Overview + Settings now exist, so **028**
  (Leads tab), **029** (Edit chat), **030** (Assets/Team), **031** (Blog), **032** (Billing) each have a
  shell to hang their tab on (each still gated by its own other blockers).
- 002 also directly unblocks 006, 014, 023, 028, 031 (per their `⊣` once their other blockers land).

## In progress
- _(nothing in flight — 010 + 011 done)_

## Done
- **010 — Onboarding shell + industry/sub-class + payment placeholder + order create (PRD §4.1 steps 4–6, §7.7,
  §15.4).** First UI slice of the build pipeline. **Shell** (`/onboarding`, its own full-screen concierge segment,
  not under the dashboard): one-question-at-a-time, top progress rail, Back, **auto-save** — each step POSTs to
  `/api/onboarding/selection` before advancing, so the server page re-derives the resume step on refresh (nothing
  lost). **Deep modules** `lib/onboarding/`: pure `steps.ts` (`INDUSTRIES` 5-card grid, `resolveResumeStep`,
  `validateSubClass`, `stepProgress`) + IO `service.ts` (`saveOnboardingSelection`, `createOrderAndEnqueue`,
  `getOnboardingState`; deps `{client,userId,send}` injected, `resolveOnboardingDeps` for prod — same pattern as
  `lib/admin/orders.ts`). **Flow** (`components/onboarding/`): `flow.tsx` orchestrator (industry → sub-class →
  payment → handoff) + `industry-grid.tsx` + `progress-rail.tsx`. **Order create**: simulated checkout (§15.4,
  no Stripe dep) → insert `payment_received` order via the advisor's RLS session + emit `order.created`;
  idempotent on double-submit (v1 = one site/account). **Auto-save persists onto `accounts`** (no progress table
  — owner decision). 3 routes (`/api/onboarding/{selection,checkout}`). **+31 logic/IO tests + 5 frontend**
  (`flow.test.tsx` walks the full RIA path + waitlist branch + error + resume). Visual-QA (temp preview, torn
  down): a11y 100 / bp 100, console clean, 375/1280. _Deferred (`[~]`): emailed magic-link → **004** (resume
  itself works); skip-with-default affordance → **013**; live DB/Inngest round-trip (no Docker)._ **Unblocks 012,
  013, 015.**
- **011 — Waitlist capture (non-RIA industries) (PRD §2.2).** Built alongside 010 — the four non-RIA cards expand
  an inline email capture in place (no nav, no account). `lib/waitlist/` (pure `validate.ts` + IO `service.ts`,
  `joinWaitlist` idempotent upsert on normalized lowercase email). Migration `20260605120000` adds the
  `waitlist_public_insert` RLS policy the core schema deferred here (anon insert, no SELECT — list stays
  service-role-only for 036) + `unique (email, industry)` dedup index. `POST /api/waitlist` (public). +9 tests
  (6 validate + 3 service) + covered in `flow.test.tsx`. _Live insert deferred (no Docker); upsert contract +
  unique index prove dedup._

- **006 — Layer-2 compliance validator + ruleset loader (PRD §5.2, §5.6, §8.1).** The automated compliance gate.
  One deep module `platform/src/lib/compliance/` built TDD-first, **no migration, no new dep**. **Hybrid by
  design:** `validateDeterministic` is the always-on authoritative backbone (word-boundary scan of context-free
  prohibited terms + required footer-element/disclosure presence — free, offline, prompt-regression-proof);
  `runAiPass` is an *additive* Gemini-Flash semantic pass (the `prohibited_content` categories +
  context-dependent superlatives) that can only ADD violations and whose absence is surfaced via
  `Layer2Result.aiPassRan`. **Loader** (`loadAndResolveRuleset`) reads the authored `compliance/ria/v1.0`
  artifacts off disk (`<platform>/../compliance`, dir-injectable so tests run against the real ruleset),
  applies the state overlay by uppercased `primary_state` for state-registered advisers, and yields a
  `ResolvedRuleset` (`versionString` "ria/v1.0" + the `{{compliance_ruleset}}` prompt text). **Persistence**
  (`mirrorRuleset` — immutable insert respecting 002's trigger; `recordViolations` — one `compliance_violations`
  row per violation with severity/field_path/ruleset_version, order_id|edit_id). **Reusable** across 020/029/031
  via `ValidationSubject` (`site` runs required-element checks; `fragment` runs prohibited-terms only so a blog
  post isn't failed for "missing CRS"). **Verify path** `GET /api/dev/compliance-check`: clean fixture → pass/0,
  seeded-bad → fail/3 (guarantee + no_risk + missing CRS) — proven in-process (route.test.ts) **and live**
  (curl). **298 tests** (+40), typecheck/lint/build green; separate `npm run evals` gate still 16/16. No UI →
  handoff is the dev endpoint + tests. _Deferred (`[~]`, no Docker/key — same as 001–009): live
  `compliance_violations` DB write + pipeline wiring land with **020** (generation still stubbed); live Flash AI
  pass activates with `GEMINI_API_KEY` (wired, stub-tested)._
- **005 — RIA v1.0 compliance ruleset + `lint:rulesets` (PRD §5.3, §5.5, §5.6, §18.2).** The moat root; unblocks
  006. **Validator** (`compliance/` workspace, **zero deps**, `node --test`): one deep module `scripts/lint.mjs`
  (pure checks `checkRulesJson`/`checkCitations`/`checkManifest(_,exists)`/`checkReviewGate`/`checkFooter` split
  from IO runners `lintRuleset`/`lintAll`, same pure/IO pattern as auth) + thin CLI `scripts/lint-rulesets.mjs`
  (`npm run lint:rulesets`, exit 0/1) + a Draft-2020-12 `rules.schema.json` (editor/contract doc; lint.mjs is
  authoritative — it does citation-id resolution, on-disk manifest reference checks, §5.7 publish gate, §18.2
  footer markers). **Authored `ria/v1.0`:** `rules.json` (4 `prohibited_terms` groups + 5 `prohibited_content`
  semantic categories + 4 `required_elements` w/ placement + 3 `required_disclosures` + SEC-vs-state
  `conditional_rules` + a `citations` map every rule resolves to), `rules.md` (citation per rule + open-items),
  `disclosures/footer-standard.md` (§18.2 template) + `crs-page-template.md`, and **10 state overlays**
  (CA/NY/TX/FL/IL/PA/NJ/MA/GA/OH) wired into `manifest.state_overlays`. **§5.7 enforced in code:** manifest stays
  `approved:false` and the linter blocks `approved:true` unless ≥2 reviewers + `published_at/by`. **31 validator
  tests** (TDD); gate proven both ways — exit 0 on `ria/v1.0`, exit 1 + 8 errors on `__fixtures__/malformed`. No
  DB/schema change, no new dependency. No UI → handoff is the runnable gate + test suite (no preview URL applies).
  _Deferred (`[~]`, the human gate by design): two-person sign-off + counsel citation-URL verification before
  publish; **second approver still TBD**. State overlays' state-specific specifics flagged for counsel review._
- **007 — Prompt harness + eval harness (PRD §8.2, §8.6).** The §8.2.8 prompt gate + the versioned generation
  contract; successor to 008 (008 client → **007 prompts+evals** → 020 generation). Three deep modules under
  `platform/` + a data/spec tree. **(1) Output schema** (`src/lib/prompts/schema.ts`): `GENERATED_SITE_SCHEMA`
  is an `OutputSchema<GeneratedSite>` (008's bring-your-own `{jsonSchema, parse}`) — `jsonSchema` steers Gemini,
  `parse` is the gate enforcing the §8.2.4 invariant (**every content field is `{value, confidence(0–1),
  sources[]}`**), recursively, with path-qualified errors. `SCHEMA_VERSION="site.v1"`. Validates *structure +
  confidence/sources only* — content-property checks (prohibited terms, CRS link) are the evals' / Layer-2's job,
  deliberately NOT the schema's. **(2) Prompt loader** (`src/lib/prompts/loader.ts`): `loadPrompt(name)` reads
  `prompts/v{N}/<name>.md` → `{version, ref:"generate-site@v1", text, frontmatter}` (`ref` = the §8.2.6 string
  callers persist on `generated_content`); `assemblePrompt` fills `{{slots}}` fail-loud (unfilled slot OR unknown
  var both throw) so the **compliance rulebook always rides in the *system* prompt via `{{compliance_ruleset}}`**
  (§8.2.2, survives scrape injection). fs only at the edge; parse/assemble pure. **(3) Eval runner**
  (`src/lib/evals/runner.ts`): pure `runEvals/runEval` + 6 property checks (schema_valid, no_prohibited_terms
  [word-boundary, so "compromise"≠"promise"], required_disclosures_present, footer_contains_crs_link,
  field_confidence_sources, prompt_contract) + `formatReport`. Cases declare `expect:"pass"|"fail"`; a **negative
  case is `ok` iff the bad input IS caught** — how the gate's teeth are tested without a permanently-red suite.
  **Prompts** (`prompts/v1/{generate-site,edit-chat,layer2-validate,blog-check}.md`): real system-instruction
  templates carrying the §8.2 markers (rulebook slot, JSON-only, confidence+sources, brand-voice slot, token
  budget). **Gate** (`npm run evals` → `vitest.evals.config.ts`, **separate** from `npm test`: globs `evals/**`,
  not `src/**`): 15 golden cases (10 output-property incl. a clean no-false-positive case + 5 prompt-contract,
  one per real prompt + a `broken-prompt.md` negative). Baseline (`evals/baseline.ts`) is a **frozen §18.2 list**,
  NOT 005's (still-placeholder) ruleset — so only a *prompt* regression turns the gate red; 006's loader supersedes
  it for live Layer-2. **Gate-bites proof:** durable negative case + demonstrated live (temp-removed `{{compliance_ruleset}}`
  from `generate-site.md` → `FAIL prompt-generate-site-contract: missing markers: ruleset_in_system`, exit 1, restored).
  **No schema/DB change, no new dep** (reuses vitest). **258 unit tests** (+33: 12 schema + 8 loader + 13 runner) +
  **15 eval cases**, typecheck/lint/build green. _Fully verifiable offline — no deferral; live model-in-the-loop
  evals (golden case → real Gemini → assert properties) are a clean extension once 020 + a key land._
- **033 (Slice 2) — Admin order detail view `/admin/orders/[id]` (PRD §11.1). 033 FULLY DONE.**
  New append-only `order_state_events` table (migration `20260601120000`, RLS-on/policy-less like
  `admin_alerts`, **not** a §10.1/PUBLIC_TABLES core table) written best-effort by `transitionOrder`
  (`recordStateEvent`, swallows its own errors — never blocks a transition) + the admin-retry reset
  (`note:'admin retry'`). `getAdminOrderDetail` = one embedded service-role read (order + firm/email
  + account→sites→deployments + intake + generated_content + compliance_violations + state events +
  alert); pure `shapeOrderDetail`/`buildStateHistory` (timeline anchored at `created_at`). Queue
  time-in-state upgraded to the latest event's `occurred_at` (additive — no-event rows keep Slice-1
  behavior, all S1 tests green). UI: `/admin/orders/[id]` page + `not-found.tsx`; `OrderDetail`
  (history timeline, intake summary, content table, color-coded violations, deploy logs) + extracted
  shared `OrderActions` (reused by queue + detail); row Order-id → detail link. **225 tests** (+24),
  typecheck/lint/build green (`[id]` compiles dynamic). Visual-QA (chrome-devtools temp preview,
  fully torn down): **a11y 100 / bp 100**, console clean, 375/1280px. _Deferred (`[~]`, no Docker):
  live embedded read + a live transition populating real events — catch-up in decisions.md._
- **033 (Slice 1) — Admin `/admin/orders`: gate + order queue + one-click retry (PRD §11.1, §13.2, §13.4).**
  First admin ticket; lays the foundation 034–036 reuse. **Admin gate** (`lib/admin/auth.ts`): owner chose an
  **env-var email allowlist** (`ADMIN_EMAILS`) over a DB role — pure `isAdminEmail` + `requireAdmin()` (pages:
  unauth→`/login`, non-admin→`notFound()` = least disclosure) + `assertAdmin()` (API: 403). **Queue**
  (`lib/admin/orders.ts`, one deep module, pure-core/IO split): `listAdminOrders` reads via the **service-role**
  client (orders/admin_alerts are RLS-internal), embedding firm+email + each order's unresolved `order_failed`
  alert; pure `shapeAdminOrders` does color-coding (`stateTone`/`stateGroup`), time-in-state, last-failure, and
  state-group/account/date filtering. **Recovery:** `retryOrder` resets the order→`payment_received`, bumps
  `retry_count`, resolves the alert, re-enqueues `order.created` (v1 restarts the pipeline; per-step resume is a
  TODO until 012–025 land real steps); `dismissAlert` resolves without re-running. Both confirmed via inline
  two-step. **UI:** `/admin` console shell (top-nav §11 surfaces, only Orders live) + `/admin/orders` page +
  §7.6 error state + `AdminOrdersTable` (all 7 §11.1 columns, color-coded Badge — added a `destructive` variant);
  routes `POST /api/admin/orders/[id]/{retry,dismiss}`. **No schema change.** **201 tests** (+28: 9 auth + 12
  orders/actions + 7 frontend), typecheck/lint/build green (4 admin routes compile dynamic). Visual-QA
  (chrome-devtools temp preview, fully torn down): **a11y 100 / best-practices 100**, console clean, 375/1280px,
  Retry confirm exercised live. _Deferred (`[~]`): order **detail view** → Slice 2; live admin read + live retry
  round-trip (no Docker/Inngest — same as 001–009; catch-up in decisions.md). Set `ADMIN_EMAILS` before deploy._

- **Review fixes — 008/009/00A (2026-06-01).** Picked up all 6 findings from
  `state/reviews/2026-06-01-008-009-00A.md`. **Cost guard (the <$2 hard guardrail) hardened:** the Gemini
  client now records token spend for *every* attempt (failed / over-cap / repair), not just the one that
  parsed (#1 — split `CostAccumulator.record` → always-on `recordUsage` + success-only `recordImage`), and
  **enforces** the dollar + image caps in-client before every dispatch via `assertCanSpend`/
  `assertCanGenerateImage` (#2 — chose enforce-in-client over caller-contract; worst-case pre-estimate =
  input + hard `capOutput`). Dropped the throwaway `estimate()` accumulator for `estimateCostUsd` (#5).
  Account-deletion re-read now uses `.maybeSingle()` + surfaces DB errors (#3); `AccountRow` aligned to the
  NOT-NULL migration (#4); `layer3Required` stub got a `TODO(020/006)` marker (#6, no behavior change).
  +9 tests (6 client cost-guard + 3 cost split) → **173 green**, typecheck/lint/build green. Rationale per
  finding in `decisions.md`. _Not done: unit test for #3 (account IO has no Supabase-mock seam — deferred
  with live read/write)._
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
- Now unblocked & pickable: **004, 016, 013 (⊣ 012✓), 037**. (012 done.) **016** is now the *last* blocker on
  **020** (generation): 020 ⊣ 012✓ + 016 — build the template shared lib (016) and the AI pipeline's generation
  stage is fully unblocked. **013** (round-1 confirm / round-2 / asset-upload UI) consumes 012's
  `structured_intake_json` + the docs-upload API and is now pickable; **015** ⊣ 013. **035** ⊣ 006✓+033✓ fully
  unblocked. **029/031/034** still gated (034 ⊣ 020; 029 ⊣ 020/024/025; 031 ⊣ 016). Still blocked: everything
  else — see `⊣ blocked by` above.
  (001, 002, 003, 005, 006, 007, 008, 009, 00A, 010, 011, 012, 027, 033 done.)

## Notes / external prerequisites (PRD §17.5)
- GitHub App registration → needed for 024.
- Vercel team account + billing → needed for 025.
- Resend domain verification (SPF/DKIM/DMARC) → needed for 004 (prod sends).
- Stripe product/price setup → needed for 032.
- Legal review of ToS/Privacy/DPA/indemnification → gates 037 (before private beta).
- **`ADMIN_EMAILS` env var** → must list the WRI team's emails before `/admin/*` is reachable (033 gate).

## Open TBDs from the HIL→AFK pass (2026-05-31)
- **Second compliance approver (005)** — name a second reviewer before the ruleset publishes.
- **Flagged-site reviewer (034)** — name who works the Layer-3 queue.
- **009 follow-up (Q4c) — STILL OPEN.** 009 shipped `layer3Required({verdict, siteIndex})` implementing the
  original §5.2 "first-50 OR Layer-2-flagged" gate. To apply Q4c, change this one predicate to **flagged-only**
  (`verdict === 'fail'`) — centralized in `lib/inngest/pipeline.ts`, a one-function edit + test update.
