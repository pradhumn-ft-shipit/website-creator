# 016 — Astro shared component lib + content schema + sitemap + section-removal + footer

**Epic:** Templates
**Type:** human-in-loop (quality-bar sign-off — anchor design — Q2b)
**Blocks:** 017, 018, 019, 020, 024, 031
**Blocked by:** 005, 001
**PRD trace:** §6.2 (sitemap), §6.3 (section-removal), §6.5 (SEO), §6.6 (a11y), §6.10/§7.11 (quality bar), §5.3 (footer disclosures)

## Slice
The Astro foundation all three templates share: content schema, sitemap, section-removal engine, compliance footer, and the quality gates — proven by one reference render.
- **Shared lib:** `templates/_shared/` component library + a versioned **content schema** (the JSON shape generation produces) covering all pages/sections.
- **Sitemap (§6.2):** `templates/_shared/sitemap.json` (Home/About/Services/Process/Who-We-Serve/Insights/Fees/Client-Login/Contact + footer), versioned per industry; editable without a code deploy.
- **Section-removal engine (§6.3):** "no empty sections" — drop unpopulated sections + auto-adjust nav (no team→single bio; no services→page removed; etc.).
- **Compliance footer:** ruleset-driven footer component (from 005) rendering ADV/CRS/privacy links + registration disclosure on every page.
- **SEO + a11y (§6.5, §6.6):** title/meta/OG/Twitter, sitemap.xml, robots.txt, JSON-LD FinancialService, favicon; ARIA landmarks, alt text, focus, contrast.
- **Quality gates:** `npm run lighthouse` (§6.10 thresholds) + `npm run a11y` (axe-core, WCAG 2.1 AA); build fails below thresholds (§7.11).
- **Verify path:** a reference template renders from a fixture content object; section-removal verified by toggling fixture fields; lighthouse + a11y pass.

## Acceptance
- [ ] Reference template builds from a fixture content object matching the shared schema.
- [ ] Removing a fixture field removes its section and updates nav (no empty sections).
- [ ] Footer renders ruleset disclosures + ADV/CRS/privacy links on every page.
- [ ] SEO defaults (§6.5) and a11y landmarks (§6.6) present.
- [ ] `npm run lighthouse` meets §6.10 thresholds; `npm run a11y` passes WCAG 2.1 AA; build fails when they don't.
- [ ] `sitemap.json` drives nav and is editable without code changes.

## Notes
- **No AI-generated people, ever** (§6.7, CLAUDE.md hard stop) — bake this assumption into image slots.
- Templates differ by styling/typography/composition but share this schema + lib (§6.1).
- The content schema here is the contract generation (020) targets — version it.

## Decision (2026-05-31)
- **Q2b — anchor sign-off.** 016 + 017 set the template quality bar; you sign off on the rendered reference once, then 018/019 inherit it AFK. The schema/sitemap/section-removal/footer/quality-gate work itself is AFK — only the visual bar needs your OK.
