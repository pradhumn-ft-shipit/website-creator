-- ============================================================================
-- 014 — SEC IAPD auto-pull support.
--
-- Create the Storage bucket compliance documents (ADV Part 2A/2B, Form CRS)
-- pulled via IAPD (or its §5.4 fallbacks) are stored in, namespaced by
-- account (`assets` already records the DB row; this just gives it a home).
-- PUBLIC (unlike the private `intake-docs` bucket, 012): these are public SEC
-- filings, and the generated site's footer (024) must be able to link to them
-- directly without a signed URL.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('customer-assets', 'customer-assets', true)
on conflict (id) do nothing;
