# 035 — Admin: /admin/compliance ruleset mgmt + research agent + publish + re-validate

**Epic:** Admin tooling
**Type:** AFK (build; two-person publish is a runtime feature — Q6a)
**Blocks:** —
**Blocked by:** 006, 033
**PRD trace:** §5.6 (versioning), §5.7 (admin/compliance tool), §11.2, CLAUDE.md (two-person review guardrail)

## Slice
Internal ruleset management — author, research, diff, and publish new compliance versions safely.
- **View (§11.2):** all rulesets (current + historical) + "live sites affected" count per version.
- **Research agent (§5.7):** trigger Gemini Pro + web search (008) to scan SEC.gov / FINRA / state boards for updates since the last published version → structured diff proposal with citations (never auto-publishes).
- **Editor (§5.7):** side-by-side Markdown + JSON editor with `lint:rulesets` (005) validation; diff viewer between any two versions.
- **Publish workflow (§5.7):** **two-person review (drafter + approver)** required before publish; writes a new `compliance/{industry}/v{N}/` artifact set + `compliance_rulesets` row.
- **On publish:** queue Layer-2 re-validation across all affected sites → flagged sites land in 034's queue (§5.6).
- **Weekly scan (§5.7):** Monday cron runs the research agent; results queued for human review.

## Acceptance
- [ ] Ruleset list shows versions + affected-site counts.
- [ ] Research agent produces a cited diff proposal and never auto-publishes.
- [ ] Editor validates via `lint:rulesets`; diff viewer compares versions.
- [ ] Publish is blocked without two-person sign-off; publishing writes the versioned artifacts + DB row.
- [ ] Publish triggers Layer-2 re-validation; flagged sites appear in `/admin/compliance/violations`.
- [ ] Weekly Monday cron queues research results for review.

## Notes
- **Guardrail (CLAUDE.md / §5.7):** never publish a ruleset without two-person review.
- Rule *content* is a versioned repo artifact (005); this tool authors new versions of it.
