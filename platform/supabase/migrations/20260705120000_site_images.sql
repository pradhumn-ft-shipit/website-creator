-- ============================================================================
-- 022 — Generated-site images support (PRD §6.7).
--
-- 1. Extend assets.type to allow 'stock' — commercial-use, no-attribution stock
--    photos (Unsplash / Pexels) downloaded and committed into the generated
--    site. AI-generated abstract/office/nature images already use the existing
--    'ai_generated' type; advisor uploads keep logo/team_photo/office/doc_*.
--
-- 2. Create the PUBLIC Storage bucket the images step writes resolved site
--    imagery to (stock + AI). It is public because these are website assets
--    served to the advisor's site visitors (unlike the private intake-docs
--    bucket, which may hold PII). Writes are server-side via the service-role
--    client; public read is enabled by the bucket flag, so no per-object policy
--    is needed.
-- ============================================================================

alter table public.assets
  drop constraint assets_type_check;

alter table public.assets
  add constraint assets_type_check check (type in (
    'logo', 'team_photo', 'office',
    'doc_adv', 'doc_crs', 'doc_other',
    'ai_generated', 'stock'));

insert into storage.buckets (id, name, public)
values ('site-assets', 'site-assets', true)
on conflict (id) do nothing;
