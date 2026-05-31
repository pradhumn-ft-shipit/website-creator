# 019 — Boutique template (editorial)

**Epic:** Templates
**Type:** AFK (inherits the anchor bar set by 017 — Q2b)
**Blocks:** 024
**Blocked by:** 016
**PRD trace:** §6.1 (Boutique aesthetic), §7.4, §7.11, §7.13 (Boutique references)

## Slice
The Boutique template, fully designed against the shared lib/schema (016).
- **Aesthetic (§6.1):** magazine-style, mixed serif/sans, photography-forward, thought-leadership / blog-prominent.
- Implements every shared-schema page (Insights/Blog prominent); obeys section-removal + compliance footer.
- Per-customer `tailwind.config.js` for brand colors.
- References (§7.13): Daffy, Compound, modern wealth-tech firms.

## Acceptance
- [ ] Renders all shared-schema pages in the Boutique aesthetic from fixture content.
- [ ] Insights/Blog layout is first-class; section-removal + ruleset footer correct.
- [ ] `npm run lighthouse` (§6.10) + `npm run a11y` (WCAG 2.1 AA) pass.
- [ ] Real-content edge-case review per §7.12; excellent on mobile at 375px.

## Notes
- Fully designed (§7.4). Load `skills/frontend-design.md`. No AI people (§6.7).
- Blog-prominent aesthetic pairs with the Insights page enabled by 031.
