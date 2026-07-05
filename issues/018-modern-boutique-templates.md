# 018 — Modern + Boutique templates

**Epic:** Templates
**Type:** AFK (inherits the anchor bar set by 016 — Q2b)
**Blocks:** 024
**Blocked by:** 016
**PRD trace:** §6.1 (Modern + Boutique aesthetics), §7.4 (fully designed), §7.11 (quality bar), §7.13 (references)

> **Consolidates former 018 + 019.** Both are the same work — a fully-designed template against the
> shared lib/schema (016), inheriting the anchor quality bar AFK. Same acceptance shape, same gates.

## Slice
The two non-anchor templates, each fully designed against the shared lib/schema (016), obeying
section-removal + the compliance footer, with a per-customer `tailwind.config.js` for brand colors.
- **Modern (§6.1):** sans-serif, generous whitespace, big imagery, short copy blocks, gradient/muted accent. References (§7.13): Wealthfront, Betterment, Facet, Altruist.
- **Boutique (§6.1):** magazine-style, mixed serif/sans, photography-forward, thought-leadership / **Insights/Blog first-class**. References (§7.13): Daffy, Compound, modern wealth-tech firms.

## Acceptance
- [ ] Both render all shared-schema pages in their respective §6.1 aesthetics from fixture content.
- [ ] Boutique's Insights/Blog layout is first-class (pairs with 031).
- [ ] Section-removal + ruleset footer behave correctly in both.
- [ ] `npm run lighthouse` (§6.10) + `npm run a11y` (WCAG 2.1 AA) pass for both.
- [ ] Real-content edge-case review per §7.12; excellent on mobile at 375px.

## Notes
- Fully designed (§7.4). Load `skills/frontend-design.md`. No AI people (§6.7).
- These inherit the bar you sign off on in 016 (Trust) — no separate visual checkpoint (Q2b).
