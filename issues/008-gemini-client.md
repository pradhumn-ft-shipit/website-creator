# 008 — Gemini client wrapper + cost guard

**Epic:** AI generation strategy
**Type:** AFK
**Blocks:** 006, 007, 012, 014, 020, 022
**Blocked by:** 001
**PRD trace:** §8.1 (model selection), §8.4 (token budgets), CLAUDE.md (cost guardrail < $2/site; Gemini rate-limit fallback)

## Slice
One deep module that every AI call goes through — model routing, structured-JSON enforcement, budgets, cost tracking.
- **Models (§8.1):** route by use case — `pro` (generation), `flash` (Layer-2 validation, edit chat), `flash-image` (capped images), `pro+search` (admin research agent). One interface, model chosen per call.
- **Structured output:** `generateJSON(schema, ...)` enforces JSON matching a versioned schema; rejects/repairs non-conforming output rather than returning free text (§8.2.3).
- **Budgets (§8.4):** per-operation input/output token targets + hard caps (full-site 30k/12k, cap 50k/20k; Layer-2 5k/1k cap 10k/2k; edit 1k/500 cap 3k/1.5k). Exceeding the hard cap **fails loudly**, never silently truncates (§8.2.7).
- **Cost guard (CLAUDE.md):** accumulate per-site token cost; expose a running total so the pipeline can stop before exceeding the < $2/site target.
- **Rate-limit fallback (CLAUDE.md):** surface a typed rate-limit error so Inngest (009) can back off + retry and log to `state/rate-limits.md`.
- **Verify path:** dev-gated endpoint generates a tiny structured object and returns token usage + estimated cost.

## Acceptance
- [ ] `generateJSON()` returns schema-valid objects and rejects/repairs malformed model output.
- [ ] Model routing selects pro / flash / flash-image / pro+search by use case.
- [ ] Exceeding a hard token cap throws a typed error (no silent truncation).
- [ ] Per-call token usage + estimated cost are returned and accumulable per site.
- [ ] Rate-limit responses surface as a typed retryable error (consumed by 009).
- [ ] Uses a separate dev API key with low quotas (§9.3); real calls (no emulator).

## Notes
- **Guardrail:** Gemini calls cost real money; keep per-site under $2. If a design pushes past it, stop and confirm.
- This module is the only place model SDK details live — callers pass schema + intent, not raw model params.
