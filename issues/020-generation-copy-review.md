# 020 — Generation: full-site copy (Layer 1 → generated_content → Layer 2) + copy preview / revisions / approval

**Epic:** AI pipeline orchestration
**Type:** human-in-loop (one wireframe checkpoint for the copy-review UI — Q1c)
**Blocks:** 024, 029
**Blocked by:** 006, 007, 008, 009, 012, 016
**PRD trace:** §5.2 (Layer 1/2), §8.2 (prompt principles), §8.3 (fields), §8.4 (budgets), §10.1 (`generated_content`), §4.1 (steps 13–15), §13.1 (copy_review → copy_approved)

> **Consolidates former 020 + 021.** Generate → preview → revise (≤3) → approve is one vertical slice:
> the backend generation step is only meaningful once its output reaches the advisor for review, and
> revisions run the same generate+validate path. Splitting them was a 5-file-limit artifact.

## Slice
The core product step — produce the full site's compliant copy as structured content, validate it,
show it to the advisor, let them revise up to 3× (each re-validated), and gate the build on approval.
- **generation.run (Inngest):** one structured call per page batch (§8.2.1) via Gemini Pro (008). **Layer 1:** inject the active ruleset (006) into the *system* prompt (§5.2, §8.2.2) so generation operates within constraints. Inputs: `structured_intake_json`, brand-voice style guide, template content schema (016).
- **Output + persist:** JSON matching the versioned content schema; every field carries `confidence` + `sources` (§8.2.4); low-confidence flagged. Write `generated_content` v1 rows per page/section with `compliance_version_used` + prompt version (§8.2.6).
- **Layer 2:** invoke 006 automatically; failures create violations + route to the manual queue (009/034).
- **Budget (§8.4):** enforce full-site token caps via 008; fail loudly past the hard cap; per-site cost < $2.
- **Copy preview (§4.1.13):** render all `generated_content` for review, page by page (§7.6 states).
- **Revisions:** up to 3 rounds via chat instruction or direct text edit; each creates a **new** `generated_content` version (never destructive) via Gemini Flash, then re-runs **Layer 2** (006). Enforce the max-3 cap (state-machine `revision_requested` loop).
- **Approval:** "Build my site" → `copy_approved` transition (009) → build-handoff screen ("check your email in ~15 min, you can log off").

## Acceptance
- [ ] One batched Pro call produces schema-valid content for all populated pages; ruleset injected in the *system* prompt; prompt + compliance versions recorded.
- [ ] Each field carries `confidence` + `sources`; sub-threshold fields flagged; `generated_content` v1 rows written.
- [ ] Layer 2 (006) runs automatically after generation; violations route to the queue.
- [ ] Token caps enforced; over-cap fails loudly; per-site cost tracked < $2.
- [ ] All generated copy renders for review.
- [ ] Revision (chat or direct edit) creates a new `generated_content` version and re-runs Layer 2; count capped at 3, further requests blocked with explanation.
- [ ] "Build my site" sets `copy_approved` and shows the build-handoff screen; no destructive updates — version history intact.

## Notes
- **Guardrail:** compliance rulebook in the *system* prompt survives injection from scraped content (§8.2.2). Never put it in the user prompt. Never approve unvalidated copy — revisions go through the same Layer-2 gate (CLAUDE.md).
- Prompt changes must pass `npm run evals` (007) before merge (§8.2.8).
- Section-removal (016) consumes the populated-vs-empty signal from this output.
- Load `skills/frontend-design.md` for the review UI (advisor-facing).

## Decision (2026-05-31)
- **Q1c — wireframe checkpoint.** Copy review gates "Build my site," so one wireframe approval, then AFK. The generation step + max-3 revision loop + Layer-2 re-validation logic need no mid-build input.
