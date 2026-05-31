# 005 — RIA v1.0 compliance ruleset + lint:rulesets

**Epic:** Compliance engine (the moat)
**Type:** AFK authoring + human gate (two-person compliance sign-off before publish — PRD §5.7) — Q3a
**Blocks:** 006, 016, 023
**Blocked by:** 001 (for the `lint:rulesets` script location; authoring can begin in parallel)
**PRD trace:** §5.3 (RIA v1 ruleset), §5.5 (state overlays), §5.6 (storage & versioning), §18.2 (quick-reference + footer template)

## Slice
Author the versioned RIA ruleset artifacts that Layers 1–3 consume, plus the validator that keeps them well-formed. Replaces the placeholder files currently in `compliance/ria/v1.0/`.
- **`rules.json`:** machine-readable — `prohibited_terms` (§18.2: guarantee/guaranteed, promise/promised, no risk, risk-free, best, top-ranked, outperform, etc. with context flags), `required_disclosures`, `required_elements` (ADV 2A/2B links, CRS link, privacy notice, state-registration disclosure, "registration does not imply skill" disclaimer), `conditional_rules` (SEC vs state).
- **`rules.md`:** human-readable with citations (SEC Marketing Rule 206(4)-1, Reg S-P, IAPD, state boards).
- **`disclosures/`:** `footer-standard.md` (the §18.2 footer template), `crs-page-template.md`, `state-overlays/{ca,ny,tx,fl,il,pa,nj,ma,ga,oh}.md` (top-10 states, §5.5).
- **`manifest.json`:** maps industry/sub-industry → rule files → version → published_at/by; mark approved only after review.
- **Tooling:** `compliance/` `npm run lint:rulesets` validates JSON against a `rules.schema.json` (terms well-formed, every required element has placement, manifest references resolve).

## Acceptance
- [ ] `npm run lint:rulesets` passes against the authored `ria/v1.0` artifacts and fails on a malformed fixture.
- [ ] `rules.json` encodes all §18.2 prohibited terms and all §5.3 required elements with placement.
- [ ] `footer-standard.md` matches the §18.2 footer template with ruleset-filled placeholders.
- [ ] Top-10 state overlays present (§5.5); SEC vs state conditional rules encoded.
- [ ] `rules.md` carries a citation for every rule; `manifest.json` resolves all referenced files.
- [ ] Two-person review recorded in `manifest.json` before `approved: true` (§5.7) — **do not publish without it.**

## Notes
- **Guardrail:** never publish a ruleset without two-person review (CLAUDE.md / §5.7). Legal review of compliance language is an external prerequisite (§17.5).
- Rule *content* is a versioned repo artifact, not a DB row; the DB only records which version a site used (§5.6, §10.2).
- This is the moat — accuracy over speed. When unsure about a rule, flag it in `rules.md` rather than guessing.

## Decision (2026-05-31)
- **Q3a — authoring AFK, sign-off stays manual.** The agent drafts the complete `ria/v1.0` ruleset (prohibited terms, disclosures, footer, 10 state overlays) with citations and runs `lint:rulesets` unattended; `manifest.json` stays `approved: false` until **two people** sign off (§5.7 hard stop). Only the final sign-off is human.
- **Second approver: TBD** — name a second reviewer before publish. External compliance counsel becomes the second reviewer before public launch (not required for alpha).
