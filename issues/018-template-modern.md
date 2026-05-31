# 018 — Modern template (clean)

**Epic:** Templates
**Type:** AFK (inherits the anchor bar set by 017 — Q2b)
**Blocks:** 024
**Blocked by:** 016
**PRD trace:** §6.1 (Modern aesthetic), §7.4, §7.11, §7.13 (Modern references)

## Slice
The Modern template, fully designed against the shared lib/schema (016).
- **Aesthetic (§6.1):** sans-serif, generous whitespace, big imagery, short copy blocks, gradient/muted accent.
- Implements every shared-schema page; obeys section-removal + compliance footer.
- Per-customer `tailwind.config.js` for brand colors.
- References (§7.13): Wealthfront, Betterment, Facet, Altruist.

## Acceptance
- [ ] Renders all shared-schema pages in the Modern aesthetic from fixture content.
- [ ] Section-removal + ruleset footer behave correctly.
- [ ] `npm run lighthouse` (§6.10) + `npm run a11y` (WCAG 2.1 AA) pass.
- [ ] Real-content edge-case review per §7.12; excellent on mobile at 375px.

## Notes
- Fully designed (§7.4). Load `skills/frontend-design.md`. No AI people (§6.7).
