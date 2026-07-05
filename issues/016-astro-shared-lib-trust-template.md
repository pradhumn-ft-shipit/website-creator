# 016 — Astro shared lib + content schema + sitemap + section-removal + footer + Trust reference template

**Epic:** Templates
**Type:** human-in-loop (one quality-bar / anchor sign-off — Q2b)
**Blocks:** 018, 020, 024, 031
**Blocked by:** 005, 001
**PRD trace:** §6.2 (sitemap), §6.3 (section-removal), §6.5 (SEO), §6.6 (a11y), §6.10/§7.11 (quality bar), §5.3 (footer disclosures), §6.1 (Trust aesthetic), §7.4 (fully designed), §7.13 (Trust references)

> **Consolidates former 016 + 017.** The shared lib is proven by rendering the Trust template against
> it — they were always the single "anchor sign-off" pair (Q2b). Building them together is the honest
> way to prove the foundation carries a real design, not a fixture.

## Slice
The Astro foundation all three templates share — content schema, sitemap, section-removal, compliance
footer, quality gates — **plus the Trust template as the reference render that proves it**.
- **Shared lib:** `templates/_shared/` component library + a versioned **content schema** (the JSON shape generation produces) covering all pages/sections. This schema is the contract 020 targets — version it.
- **Sitemap (§6.2):** `templates/_shared/sitemap.json` (Home/About/Services/Process/Who-We-Serve/Insights/Fees/Client-Login/Contact + footer), versioned per industry; editable without a code deploy — drives nav.
- **Section-removal engine (§6.3):** "no empty sections" — drop unpopulated sections + auto-adjust nav (no team→single bio; no services→page removed; etc.).
- **Compliance footer:** ruleset-driven footer (from 005) rendering ADV/CRS/privacy links + registration disclosure on every page.
- **SEO + a11y (§6.5, §6.6):** title/meta/OG/Twitter, sitemap.xml, robots.txt, JSON-LD FinancialService, favicon; ARIA landmarks, alt text, focus, contrast.
- **Quality gates:** `npm run lighthouse` (§6.10 thresholds) + `npm run a11y` (axe-core, WCAG 2.1 AA); build fails below thresholds (§7.11).
- **Trust template (§6.1, §7.4):** serif headings, navy/charcoal palette, advisor-photo hero, credentials-heavy, long-form About. Implements every shared-schema page; obeys section-removal + compliance footer; per-customer `tailwind.config.js` for brand colors. References (§7.13): Fisher Investments, Edelman Financial Engines.

## Acceptance
- [ ] Reference (Trust) template builds from a fixture content object matching the shared schema.
- [ ] Removing a fixture field removes its section and updates nav (no empty sections).
- [ ] Footer renders ruleset disclosures + ADV/CRS/privacy links on every page.
- [ ] SEO defaults (§6.5) and a11y landmarks (§6.6) present.
- [ ] `npm run lighthouse` meets §6.10 thresholds; `npm run a11y` passes WCAG 2.1 AA; build fails when they don't.
- [ ] `sitemap.json` drives nav and is editable without code changes.
- [ ] Trust renders all shared-schema pages in its §6.1 aesthetic; real-content edge cases (long firm name, no team photo, 10 designations) per §7.12; excellent on mobile at 375px.

## Notes
- **No AI-generated people, ever** (§6.7, CLAUDE.md hard stop) — bake this into image slots.
- Templates differ by styling/typography/composition but share this schema + lib (§6.1).
- Fully designed, not a starting point (§7.4). Load `skills/frontend-design.md`.

## Decision (2026-05-31)
- **Q2b — anchor sign-off.** This ticket sets the template quality bar; you sign off on the rendered Trust reference once, then 018 (Modern + Boutique) inherit it AFK. The schema/sitemap/section-removal/footer/quality-gate work is AFK — only the visual bar needs your OK.
