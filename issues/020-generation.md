# 020 — Generation: full-site copy (Layer 1) → generated_content

**Epic:** AI pipeline orchestration
**Type:** AFK
**Blocks:** 021, 024, 029
**Blocked by:** 006, 007, 008, 009, 012, 016
**PRD trace:** §5.2 (Layer 1), §8.2 (prompt principles), §8.3 (fields), §8.4 (budgets), §10.1 (`generated_content`)

## Slice
The core product step: produce the full site's compliant copy as structured content, then validate it.
- **generation.run (Inngest):** one structured call per page batch (§8.2.1) via Gemini Pro (008). **Layer 1:** inject the active ruleset (from 006) into the *system* prompt (§5.2, §8.2.2) so generation operates within constraints. Inputs: `structured_intake_json`, brand-voice style guide, template content schema (016).
- **Output:** JSON matching the versioned content schema; every field carries `confidence` + `sources` (§8.2.4); low-confidence fields flagged for review.
- **Persist:** write `generated_content` rows (version 1) per page/section with `compliance_version_used` + prompt version (§8.2.6).
- **Then Layer 2:** invoke 006; failures create violations + route to the manual queue (009/034).
- **Budget (§8.4):** enforce full-site token caps via 008; fail loudly past the hard cap; keep per-site cost < $2.
- **Verify path:** a seeded intake produces `generated_content` v1 for all populated pages; Layer 2 runs automatically.

## Acceptance
- [ ] One batched Pro call produces schema-valid content for all populated pages.
- [ ] Ruleset injected in the system prompt (Layer 1); prompt + compliance versions recorded.
- [ ] Each field carries `confidence` + `sources`; sub-threshold fields flagged.
- [ ] `generated_content` v1 rows written per page/section.
- [ ] Layer 2 (006) runs automatically after generation; violations route to the queue.
- [ ] Token caps enforced; over-cap fails loudly; per-site cost tracked < $2.

## Notes
- **Guardrail:** compliance rulebook in the *system* prompt survives injection from scraped content (§8.2.2). Never put it in the user prompt.
- Prompt changes must pass `npm run evals` (007) before merge (§8.2.8).
- Section-removal (016) consumes the populated-vs-empty signal from this output.
