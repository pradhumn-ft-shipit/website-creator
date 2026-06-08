-- ============================================================================
-- 012 — Scrape / intake support.
--
-- 1. Enforce the "one intake_data per order" invariant the rest of the codebase
--    already assumes (PRD §10: one account = one website = one order = one
--    intake). A UNIQUE constraint on order_id lets the scrape/intake steps
--    upsert the row idempotently (Inngest retries re-run a step) and read it
--    with .single() without ambiguity.
--
-- 2. Create the private Storage bucket the docs-upload fallback (§4.2/§4.3)
--    writes to. Uploads are server-side via the service-role client (which
--    bypasses Storage RLS), so no per-object policy is needed; the bucket is
--    private (no public read) because uploaded brochures may contain PII.
-- ============================================================================

alter table public.intake_data
  add constraint intake_data_order_id_key unique (order_id);

insert into storage.buckets (id, name, public)
values ('intake-docs', 'intake-docs', false)
on conflict (id) do nothing;
