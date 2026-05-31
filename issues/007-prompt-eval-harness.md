# 007 — Prompt harness + eval harness

**Epic:** AI generation strategy
**Type:** AFK
**Blocks:** 020
**Blocked by:** 001, 008
**PRD trace:** §8.2 (prompt guiding principles), §8.6 (evaluation harness)

## Slice
Versioned prompts + a golden-case eval gate, so every prompt change is tested before merge (§8.2.8).
- **Prompts:** `prompts/v1/` markdown files (e.g. `generate-site.md`, `edit-chat.md`, `layer2-validate.md`, `blog-check.md`). A loader returns prompt text + records the prompt version used by callers.
- **Principles enforced (§8.2):** compliance rulebook goes in the *system* prompt (survives injection from scraped content); output is JSON against a versioned schema; every generated field carries `confidence` (0–1) + `sources[]`; brand-voice 3–5 line style guide slot; token budget per call.
- **Evals:** `evals/` golden cases — each is an input fixture + expected *properties* (not exact text): "footer contains CRS link", "no prohibited terms", "JSON schema valid", "all required elements present". 10–20 cases.
- **Runner:** `npm run evals` runs cases against the current prompts/schemas and reports pass/fail; CI-ready.

## Acceptance
- [ ] `npm run evals` runs the golden cases and reports per-case pass/fail with a nonzero exit on failure.
- [ ] Prompt loader returns text + a version string that callers can persist on generated rows.
- [ ] At least 10 golden cases exist, asserting properties (CRS link present, no prohibited terms, schema-valid).
- [ ] A deliberately-broken prompt fixture makes `npm run evals` fail (proves the gate bites).
- [ ] Output schema enforces `confidence` + `sources[]` per field (§8.2.4).

## Notes
- Evals assert properties, never exact strings — copy will change; the contract is structural (§8.6).
- New evals get added whenever a real customer hits an edge case worth preventing (§8.6) — leave that documented.
- Prompts themselves are iterated rapidly in alpha; the *harness* is the fixed deliverable here.
