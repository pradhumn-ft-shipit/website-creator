# 031 — Blog upload + compliance check + publish

**Epic:** Customer dashboard
**Type:** AFK (Q1c design autonomy; + Q7b interest-capture scope)
**Blocks:** —
**Blocked by:** 006, 016, 027, 002
**PRD trace:** §5.9 (blog compliance), §12.7 (blog tab), §6.2 (Insights page)

## Slice
Let advisors publish markdown blog posts that pass the same compliance pipeline.
- **Upload (§12.7):** `.md` only; required frontmatter `title`, `slug`, `excerpt`, `publish_date`; markdown body. Writes `blog_posts` (`status: pending_review`).
- **Compliance (§5.9):** Layer 1 (ruleset + MD as context, flag issues) + Layer 2 (006: prohibited terms, forward-looking statements, performance claims). Flagged passages shown with AI-suggested rewrites.
- **Approve → publish:** advisor must approve the final version; published posts render at `/insights/{slug}` (if the Insights page is enabled in the template, 016).
- **Limit (§12.7):** 2 posts per calendar month per customer — warn near limit, hard-block at limit with a friendly upsell.
- **Verify path:** a clean post passes + publishes; a post with "guaranteed returns" is flagged with a rewrite; the 3rd post in a month is blocked.

## Acceptance
- [ ] `.md` upload with required frontmatter creates a `blog_posts` row (`pending_review`).
- [ ] Layer 1 + Layer 2 run; flagged passages show suggested rewrites.
- [ ] Advisor approval required before publish; published posts render at `/insights/{slug}`.
- [ ] 2-per-calendar-month limit enforced with warning + hard block.
- [ ] Non-compliant content cannot be published without resolving flags.

## Notes
- Same compliance gate as site copy (CLAUDE.md) — blog is not exempt.
- WRI does not manually gate blog publication in v1 (§13.3) — advisor approval is the gate.

## Decision (2026-05-31)
- **Q1c** — blog review UX is AFK.
- **Q7b — interest capture, not upsell.** At the 2-posts/calendar-month limit, hard-block with an **interest-capture prompt** ("Need more posts? Tell us") that logs demand for a future content tier — there is no higher plan to upsell to in v1, so don't imply one. Near-limit warning unchanged.
