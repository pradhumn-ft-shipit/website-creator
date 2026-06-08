-- ============================================================================
-- Seed — one user → account → order chain, so a fresh DB has something to
-- round-trip (PRD §10 verify path; ticket 002 acceptance). Run automatically
-- by `supabase db reset`. Idempotent: fixed UUIDs + ON CONFLICT DO NOTHING.
-- Runs as the postgres superuser, which bypasses RLS.
-- ============================================================================

insert into public.users (id, email, email_verified_at)
values ('00000000-0000-0000-0000-000000000001', 'seed-advisor@example.com', now())
on conflict (id) do nothing;

insert into public.accounts (id, user_id, firm_name, industry, sub_industry, primary_state, subscription_status, plan)
values ('00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000001',
        'Seed Capital Advisors', 'ria', 'ria_sec', 'CA', 'active', 'monthly')
on conflict (id) do nothing;

insert into public.orders (id, account_id, status)
values ('00000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000002',
        'payment_received')
on conflict (id) do nothing;

-- Intake row for the seeded order, so the 012 pipeline has an existing-site URL
-- to scrape on a fresh DB (PRD §4.1 step 7 verify path).
insert into public.intake_data (id, order_id, existing_site_url)
values ('00000000-0000-0000-0000-000000000004',
        '00000000-0000-0000-0000-000000000003',
        'https://example-advisors.com')
on conflict (order_id) do nothing;
