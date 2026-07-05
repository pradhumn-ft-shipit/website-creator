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
- [x] Ruleset list shows versions + affected-site counts. — `/admin/compliance` VersionsTable; `versions.ts` `countLiveSitesByVersion`/`shapeVersions` (versions.test.ts) + console test asserts the `affected-<v>` count renders.
- [x] Research agent produces a cited diff proposal and never auto-publishes. — `research.ts` `runResearchAgent` (Gemini `research` use case + `compliance_research` budget) → `parseResearchProposal` REJECTS any uncited change (research.test.ts); the route only returns a proposal (no persistence/publish).
- [~] Editor validates via `lint:rulesets`; diff viewer compares versions. — `diffRulesets` built + tested (diff.test.ts); `lint:rulesets` (005) is invoked at publish time via `wiring.loadRulesetLinter` and BLOCKS an invalid publish (publish.test.ts `ruleset_invalid`). The side-by-side Markdown/JSON *editor UI* + interactive *diff-viewer UI* are deferred (see decisions) — the diff/lint engines they wire to are done.
- [x] Publish is blocked without two-person sign-off; publishing writes the versioned artifacts + DB row. — `assertTwoPersonApproval` (publish.test.ts: 1 signer / same-person-both-roles rejected, distinct drafter+approver passes); `publishDraft` writes `compliance/{industry}/v{N}/` artifacts + inserts `compliance_rulesets` row; the two failing-gate tests assert NO writes/send occur.
- [~] Publish triggers Layer-2 re-validation; flagged sites appear in `/admin/compliance/violations`. — publish sends `compliance.revalidate`; `complianceRevalidation` Inngest fn + `recordRevalidationResult` write the 034 queue records (`compliance_violations` + `compliance_review` admin_alert — revalidation.test.ts). The `/admin/compliance/violations` **UI is 034** (not this ticket); the per-site Layer-2 reassembly is a marked `TODO(020)` (content shape). Records/interface it consumes are produced.
- [x] Weekly Monday cron queues research results for review. — `complianceWeeklyScan` cron (`0 9 * * 1` ET) runs the agent → files a DRAFT (never publishes); live scheduling gated behind `INNGEST_COMPLIANCE_SCAN_ENABLED` (deferred until keys/quotas, noted in decisions).

## Notes
- **Guardrail (CLAUDE.md / §5.7):** never publish a ruleset without two-person review.
- Rule *content* is a versioned repo artifact (005); this tool authors new versions of it.
