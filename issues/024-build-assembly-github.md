# 024 — Build assembly + GitHub repo create/push (GitHub App)

**Epic:** AI pipeline orchestration
**Type:** AFK
**Blocks:** 025, 029
**Blocked by:** 016, 017, 018, 019, 020, 023, 009
**PRD trace:** §9.2 (build/assemble/repo steps), §9.5 (GitHub integration), §6.10/§7.11 (quality gate), CLAUDE.md (archive-never-delete; GitHub rate-limit fallback)

## Slice
Assemble the chosen template + content + assets into a buildable Astro site and push it to a per-customer GitHub repo.
- **build.assemble (Inngest):** merge `sites.template_id` template + approved `generated_content` + `assets` (logos/photos/IAPD docs) + legal pages (023) → a complete Astro project; apply section-removal; write per-customer `tailwind.config.js` (brand colors).
- **Quality gate (§7.11):** run lighthouse + a11y (016 scripts) on the assembled build; **block push if any §6.10 threshold fails.**
- **repo.create + repo.push (§9.5):** via **GitHub App** (never PAT); repo `customer-{slug}-{shortid}`, private; commit messages tagged with the order/edit ID. GitHub rate-limit → Inngest backoff + auto-resume (CLAUDE.md), log to `state/rate-limits.md`.
- **Persist:** `sites.github_repo_url`.
- **Verify path:** a seeded approved order assembles + pushes a buildable repo; a failing-lighthouse fixture blocks the push.

## Acceptance
- [ ] Assembly produces a buildable Astro project from template + content + assets + legal pages.
- [ ] Section-removal applied; per-customer `tailwind.config.js` carries brand colors.
- [ ] Lighthouse/a11y gate blocks push on any §6.10 threshold failure.
- [ ] Repo created via GitHub App (not PAT), private, named `customer-{slug}-{shortid}`.
- [ ] Commits tagged with order/edit ID; `sites.github_repo_url` persisted.
- [ ] GitHub rate-limit backs off + auto-resumes + logs to `state/rate-limits.md`.

## Notes
- External prerequisite (§17.5): GitHub App registration before this runs in prod.
- **Destructive guardrail:** customer repos are archived, never deleted (CLAUDE.md / §4.6) — relevant to 032.
