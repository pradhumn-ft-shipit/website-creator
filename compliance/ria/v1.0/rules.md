# RIA Compliance Ruleset — v1.0 (DRAFT)

**Status:** draft · **Industry:** RIA (SEC- and state-registered investment advisers) · **Not yet approved.**

> ⚠️ This ruleset is authored from PRD §5 (compliance framework) and §18.2 (quick-reference), with
> citations. It must pass two-person review (PRD §5.7) before `manifest.json` is marked `approved: true`
> and used in generation. Authoring (this file + `rules.json`) is the AFK deliverable of ticket 005; the
> sign-off is the human gate. **Counsel must verify every citation URL before publish.** The machine-readable
> counterpart is `rules.json`; `npm run lint:rulesets` validates the two stay well-formed and consistent.

## How this ruleset is used (three-layer engine — §5.2)

1. **Layer 1 — prevention:** the active ruleset is injected into Gemini's *system* prompt so generation
   operates within constraints (forbidden terms, required disclosures, mandated footer elements).
2. **Layer 2 — validation:** a separate Gemini Flash pass scans output for the `prohibited_terms` /
   `prohibited_content` here and confirms every `required_elements` / `required_disclosures` is present.
3. **Layer 3 — manual gate:** WRI team review for any Layer-2-flagged site (per the Q4c decision).

Every generated piece records the ruleset version it was built against (`compliance_version_used`).

## Authority sources (§18.2)

| id | Source | Citation |
|----|--------|----------|
| `sec_marketing_rule` | SEC Investment Adviser Marketing Rule | 17 CFR 275.206(4)-1 (modernized 2021) |
| `sec_form_adv_2a` | Form ADV Part 2A — Firm Brochure | SEC Form ADV |
| `sec_form_adv_2b` | Form ADV Part 2B — Brochure Supplement | SEC Form ADV |
| `sec_form_crs` | Form CRS / Form ADV Part 3 | SEC Customer Relationship Summary |
| `reg_sp` | Regulation S-P (privacy) | 17 CFR Part 248 |
| `advisers_act` | Investment Advisers Act of 1940 | Pub. L. 76-768 |
| `nasaa_state` | NASAA / state securities regulators | State IA registration |

## Prohibited terms (Layer 2 literal scan — §18.2)

Each term is scanned with the indicated match mode. `requires_substantiation: true` means the term is only a
violation when used as an unsubstantiated marketing claim (Layer 2's LLM judges context; a literal substring
gate would false-positive).

- **`guarantee`** (`guarantee`, `guaranteed`, `guarantees`) — **high**. Guarantees of performance, returns, or
  outcomes are prohibited. *Source: `sec_marketing_rule` (Marketing Rule general prohibitions on untrue/misleading statements).*
- **`promise`** (`promise`, `promised`, `promises`) — **high**. Promises of investment results are prohibited.
  *Source: `sec_marketing_rule`.*
- **`no_risk`** (`no risk`, `risk-free`, `risk free`, `riskless`, `zero risk`) — **high**. Claims that an
  investment carries no risk are prohibited. *Source: `sec_marketing_rule`.*
- **`unsubstantiated_superlatives`** (`best`, `top-ranked`, `top-rated`, `#1`, `outperform`, …) — **medium**,
  requires substantiation. Superlatives, rankings, and outperformance claims are prohibited unless substantiated
  and accompanied by the Marketing Rule's required disclosures. *Source: `sec_marketing_rule`.*

## Prohibited content (Layer 2 semantic — §5.3)

These are content categories the Marketing Rule restricts that are not single-word scans; Layer 2's model
evaluates them.

- **`unsubstantiated_performance`** — **high**. Performance claims without the required calculations, time
  periods, and disclosures (net-of-fees, standardized periods). *Source: `sec_marketing_rule`.*
- **`hypothetical_performance`** — **high**. Hypothetical/backtested/projected performance without the required
  hypothetical-performance disclosures and audience restrictions. *Source: `sec_marketing_rule`.*
- **`testimonials`** — **high**. Client testimonials disallowed entirely in v1 (v2 adds compliant blocks).
  *Source: `sec_marketing_rule` (testimonial/endorsement provisions).*
- **`endorsements_without_disclosure`** — **high**. Endorsements without compensation/conflict disclosure.
  *Source: `sec_marketing_rule`.*
- **`forward_looking_without_risk`** — **medium**. Forward-looking statements without risk disclosure.
  *Source: `sec_marketing_rule`.*

## Required elements (must be present — §5.3)

- **Form ADV Part 2A** — footer link. *Source: `sec_form_adv_2a`.*
- **Form ADV Part 2B** — footer link. *Source: `sec_form_adv_2b`.*
- **Form CRS** — footer link **and** a dedicated page (prominent). *Source: `sec_form_crs`.*
- **Privacy Policy** — footer link and a dedicated page (Reg S-P). *Source: `reg_sp`.*

## Required disclosures (text — §5.3 / §18.2)

- **`registration_no_skill`** — "Registration does not imply a certain level of skill or training." (footer).
  *Source: `sec_form_crs`.*
- **`informational_only`** — "Information on this website is for informational purposes only and does not
  constitute investment, tax, or legal advice." (footer). *Source: `advisers_act`.*
- **`privacy_notice`** — Regulation S-P privacy notice on the privacy page. *Source: `reg_sp`.*

## Conditional rules (SEC vs. state — §5.5)

Classification is driven by the onboarding AUM question: **AUM ≥ $100M → SEC-registered**; **AUM < $100M →
state-registered** (§5.5).

- **`sec_registration_disclosure`** (`when registration = sec`) — footer states SEC registration:
  "{{firm_name}} is an SEC-registered investment adviser." *Source: `advisers_act`.*
- **`state_registration_disclosure`** (`when registration = state`) — footer states state registration and the
  matching **state overlay** (`disclosures/state-overlays/<state>.md`) is applied. *Source: `nasaa_state`.*

> State overlays for the top-10 states by RIA count (CA, NY, TX, FL, IL, PA, NJ, MA, GA, OH — §5.5) live under
> `disclosures/state-overlays/` and are wired into `manifest.json` (`state_overlays[]`). Each overlay supplies the
> state-specific footer registration line + regulator citation. State-specific *requirements* beyond the federal
> set still need counsel verification (flagged in each overlay) before publish.

## Footer template

The auto-generated footer is `disclosures/footer-standard.md` (matches the §18.2 template; placeholders filled
from intake + this ruleset). The dedicated Form CRS page uses `disclosures/crs-page-template.md`.

## Open items for review (flag, don't guess — §5.7)

- **Citation URLs** must be verified by counsel before publish; titles are authoritative, URLs are best-effort.
- **`promise`** is context-sensitive (ordinary service copy may say "we promise responsive service"); Layer 2
  judges intent. Confirm the desired strictness during review.
- **Second approver: TBD** (see `manifest.json` → `review.reviewers`). External compliance counsel becomes the
  second reviewer before public launch (not required for alpha).
