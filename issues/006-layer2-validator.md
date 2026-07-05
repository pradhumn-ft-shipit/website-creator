# 006 — Compliance Layer-2 validator + ruleset loader

**Epic:** Compliance engine (the moat)
**Type:** AFK
**Blocks:** 020, 029, 031, 034
**Blocked by:** 002, 005, 008
**PRD trace:** §5.2 (three-layer engine — Layer 2), §5.6 (versioning), §8.1 (Flash for validation)

## Slice
The automated validation gate that scans generated output for prohibited terms and missing required elements.
- **Ruleset loader (deep module):** loads the active `compliance/{industry}/v{version}/` artifacts (from 005), resolves state overlays by `accounts.primary_state`, and returns the resolved ruleset + its version string. Mirrors the active version into `compliance_rulesets` for runtime lookup; records the version on consumers.
- **Layer-2 validator:** Gemini Flash (via 008) scans content for prohibited terms (§5.2), required-element presence (footer disclosures, CRS link, ADV link, privacy link), and state-specific requirements. Returns a structured result: pass/fail + per-violation `{field_path, severity, description}`.
- **Persistence:** failures write `compliance_violations` rows and signal the order to the manual review queue (Layer 3, handled in 009/034).
- **Reusable:** called by generation (020), edit chat (029), and blog (031).
- **Verify path:** dev endpoint validates a clean fixture (pass) and a fixture seeded with "guaranteed" + missing CRS link (fail with two violations).

## Acceptance
- [x] Loader returns the resolved ruleset + version; state overlay applied by `primary_state`. — `loadAndResolveRuleset` (loader.ts); `versionString` = "ria/v1.0"; CA/NY/… overlays applied by uppercased `primaryState` for state-registered advisers (loader.test.ts + ruleset.test.ts).
- [x] Validator flags every §18.2 prohibited term present in a fixture. — deterministic word-boundary scan flags the context-free hard terms (guarantee/promise/no-risk/risk-free…); context-dependent superlatives (best/outperform) are routed to the AI pass to avoid false positives (validator.test.ts; live curl flagged `guarantee` + `no_risk`).
- [x] Validator flags missing required elements (CRS/ADV/privacy links, disclosures). — `checkRequiredElements` (footer link by kind) + `checkRequiredDisclosures` (text-pattern presence) on `kind:"site"` (validator.test.ts; live curl flagged missing `crs`).
- [x] Failures create `compliance_violations` rows with `field_path` + `severity`. — `recordViolations` (persistence.ts) inserts one row per violation with `severity`/`field_path`/`ruleset_version`/`order_id|edit_id` (persistence.test.ts, mock service-role client). _Live DB write + pipeline wiring deferred to 020 (no Docker; generation still stubbed)._
- [x] The consumed ruleset version is recorded on the validated artifact. — every `Layer2Result` carries `rulesetVersion`; `recordViolations` writes `ruleset_version`. _`generated_content.compliance_version_used` is written by 020 using this same `versionString`._
- [x] Pass and fail fixtures both verified via the dev endpoint. — `GET /api/dev/compliance-check`: clean fixture → pass/0, seeded-bad fixture → fail/3 (guarantee + no_risk + missing CRS). Verified in-process (route.test.ts) **and** live (`curl localhost:3000/api/dev/compliance-check`).

## Notes
- **Guardrail:** never ship copy that hasn't passed Layer 2 (CLAUDE.md). This module is that gate.
- Compliance rulebook content lives in the system prompt at generation (Layer 1, in 020); Layer 2 is an independent second pass — keep them separate so a single prompt regression can't disable the check.
