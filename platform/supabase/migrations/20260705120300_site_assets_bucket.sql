-- ============================================================================
-- 013 — Site-assets Storage bucket.
--
-- The intake flow (§4.1.11, §6.8) lets advisors upload a logo, team photos, and
-- office photos. These land in a private bucket, written server-side via the
-- service-role client (which bypasses Storage RLS) exactly like the `intake-docs`
-- bucket (012) — so no per-object policy is needed. The bucket is private
-- because team/office photos are PII-adjacent; the generated site consumes
-- processed copies at build time (024), it does not hot-link this bucket.
--
-- Each upload also creates an `assets` row (typed logo/team_photo/office) and,
-- for team photos, a `team_members` row — those tables + their owner RLS
-- policies already exist (core schema + rls_policies). This migration only adds
-- the storage bucket.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('site-assets', 'site-assets', false)
on conflict (id) do nothing;
