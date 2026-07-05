-- ============================================================================
-- 022 — Generated-site images support (PRD §6.7).
--
-- Extend assets.type to allow 'stock' — commercial-use, no-attribution stock
-- photos (Unsplash / Pexels) downloaded and committed into the generated site.
-- AI-generated abstract/office/nature images already use the existing
-- 'ai_generated' type; advisor uploads keep logo/team_photo/office/doc_*.
--
-- This is the single, authoritative assets.type definition after the merge
-- reconciliation: the union of the core-schema types + 022's 'stock' addition.
--
-- NOTE (merge reconciliation, 2026-07-06): 022 originally created its own PUBLIC
-- `site-assets` bucket. That collided with 013's PRIVATE `site-assets` bucket
-- (advisor-uploaded logo/team/office photos — PII-adjacent, must stay private).
-- To keep PII private AND give the generated site's public imagery a public
-- home, the images step now writes to the PUBLIC `customer-assets` bucket
-- created by 014's migration (20260705120100). See lib/images/service.ts
-- (SITE_ASSETS_BUCKET → "customer-assets") and state/decisions.md.
-- ============================================================================

alter table public.assets
  drop constraint assets_type_check;

alter table public.assets
  add constraint assets_type_check check (type in (
    'logo', 'team_photo', 'office',
    'doc_adv', 'doc_crs', 'doc_other',
    'ai_generated', 'stock'));
