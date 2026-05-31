# 015 — Template selection UI

**Epic:** Templates
**Type:** AFK (design autonomy via frontend-design skill + §7 — Q1c)
**Blocks:** 024
**Blocked by:** 013, 002
**PRD trace:** §4.1 (step 9), §6.1 (three templates)

## Slice
Let the advisor choose one of the three templates, previewed with their brand.
- **UI:** Trust / Modern / Boutique shown side-by-side (§6.1 aesthetics + target personas), each previewed with brand colors extracted in 012 when available.
- **Service:** writes `sites.template_id` (`trust|modern|boutique`); one site per account (v1).
- **No switching after deploy (§3.2):** selection is locked post-build (enforced later by edit-chat guardrails in 029).

## Acceptance
- [ ] Three templates render side-by-side with their §6.1 descriptions.
- [ ] Brand-color preview applied when colors were extracted; sensible default otherwise.
- [ ] Selection persists to `sites.template_id`.
- [ ] Exactly one site per account is created/updated.

## Notes
- Template previews must look polished — templates are the product (§7.4). Load `skills/frontend-design.md`.
- Template switching after deploy is explicitly out of scope (§3.2).
