# 023 — Generated-site legal pages: privacy / ToS / 404 / hygiene

**Epic:** Legal & privacy
**Type:** AFK
**Blocks:** 024
**Blocked by:** 002, 005
**PRD trace:** §6.9 (hygiene pages), §14.1 (generated-site legal content)

## Slice
Auto-generate the legal + hygiene pages every customer site must ship.
- **Privacy Policy (§14.1):** generated per industry + state of operation; covers contact-form data collection (Reg S-P aware).
- **ToS / Disclaimer (§14.1):** "for informational purposes only," no advice via website, limited advisor liability.
- **404 (§6.9):** matches template aesthetic, "Back home" link, search prompt.
- **Compliance disclosures:** footer-driven from the ruleset (handled by 016's footer); these pages are the linked targets.
- **Output:** content objects consumable by the templates/build (024); placed at the correct routes.
- **Verify path:** privacy/ToS generate for a CA state-registered fixture and an SEC fixture, differing where state requires.

## Acceptance
- [ ] Privacy Policy generated per industry+state; covers contact-form collection.
- [ ] ToS/Disclaimer generated with the §14.1 limitations.
- [ ] 404 page matches the chosen template aesthetic.
- [ ] State-specific differences appear for state-registered fixtures.
- [ ] Pages are wired as the footer's linked targets (with 016).

## Notes
- Generated-site legal is distinct from platform-side legal (037).
- Privacy/ToS are required pages (cannot be removed via edit chat — §4.4).
