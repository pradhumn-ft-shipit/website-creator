-- Waitlist capture (PRD §2.2, ticket 011).
--
-- The four non-RIA industry cards capture an email from an unauthenticated
-- visitor. Two things the core schema deferred to this ticket:
--
--   1. Dedup: a unique (email, industry) index so a re-submit is a no-op
--      (the service inserts with ignoreDuplicates). Emails are normalized to
--      lowercase in lib/waitlist/service.ts before insert, so casing collapses.
--   2. Public insert: the table has RLS on with no policy (deny-by-default).
--      This adds INSERT-only for anon/authenticated; there is deliberately no
--      SELECT policy, so the list stays readable only via the service-role key
--      (the future /admin/leads surface, ticket 036).

create unique index if not exists waitlist_email_industry_key
  on public.waitlist (email, industry);

create policy waitlist_public_insert on public.waitlist
  for insert to anon, authenticated
  with check (true);
