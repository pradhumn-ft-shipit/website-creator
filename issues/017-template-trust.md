# 017 — Trust template (traditional)

**Epic:** Templates
**Type:** human-in-loop (quality-bar sign-off — anchor design — Q2b)
**Blocks:** 024
**Blocked by:** 016
**PRD trace:** §6.1 (Trust aesthetic), §7.4 (fully designed), §7.11 (quality bar), §7.13 (Trust references)

## Slice
The Trust template, fully designed against the shared lib/schema (016).
- **Aesthetic (§6.1):** serif headings, navy/charcoal palette, advisor-photo hero, credentials-heavy, long-form About.
- Implements every shared-schema page; obeys section-removal + compliance footer from 016.
- Per-customer `tailwind.config.js` for brand colors.
- References (§7.13): Fisher Investments, Edelman Financial Engines.

## Acceptance
- [ ] Renders all shared-schema pages in the Trust aesthetic from fixture content.
- [ ] Section-removal + ruleset footer behave correctly.
- [ ] `npm run lighthouse` (§6.10) + `npm run a11y` (WCAG 2.1 AA) pass.
- [ ] Real-content review with edge cases (long firm name, no team photo, 10 designations) per §7.12.
- [ ] Excellent on mobile at 375px (§7.2.7, §7.12).

## Notes
- Fully designed, not a starting point (§7.4). Load `skills/frontend-design.md`. No AI people (§6.7).

## Decision (2026-05-31)
- **Q2b — anchor template.** Trust is the reference render you sign off on (templates are the product, §7.4). Your approval here sets the bar that 018 (Modern) and 019 (Boutique) match AFK.
