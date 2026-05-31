# Project Plan — WRI (Website for Regulatory Industries)

> Read first at the start of every session. Update at the end of every task.
> The plan is the collection of tickets in `issues/`. This file is the at-a-glance DAG + status.
> There are no phases — only "what is currently unblocked." Pick the lowest-ID unblocked ticket.

## Status: Planned — all 37 tickets written

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

- **001** — Platform scaffold. Everything hangs off it. **Start here.**
- (Authoring of **005** compliance content can begin in parallel; its `lint:rulesets` script lands with 001.)

After 001 merges → 002, 004, 005, 007*, 008, 009, 011, 037 unblock (*007 also needs 008).

## In progress
- _none_

## Done
- Repo scaffold (git init, state/, issues/, compliance/ria/v1.0/, platform/, templates/, .gitignore).
- PRD read end-to-end; v1 DAG defined.

## Blocked
- Everything except 001 (and 005 authoring) — see `⊣ blocked by` above.

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
