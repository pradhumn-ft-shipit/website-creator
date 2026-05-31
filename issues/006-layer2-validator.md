# 006 — Compliance Layer-2 validator + ruleset loader

**Epic:** Compliance engine (the moat)
**Type:** AFK
**Blocks:** 020, 021, 029, 031, 034
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
- [ ] Loader returns the resolved ruleset + version; state overlay applied by `primary_state`.
- [ ] Validator flags every §18.2 prohibited term present in a fixture.
- [ ] Validator flags missing required elements (CRS/ADV/privacy links, disclosures).
- [ ] Failures create `compliance_violations` rows with `field_path` + `severity`.
- [ ] The consumed ruleset version is recorded on the validated artifact.
- [ ] Pass and fail fixtures both verified via the dev endpoint.

## Notes
- **Guardrail:** never ship copy that hasn't passed Layer 2 (CLAUDE.md). This module is that gate.
- Compliance rulebook content lives in the system prompt at generation (Layer 1, in 020); Layer 2 is an independent second pass — keep them separate so a single prompt regression can't disable the check.
