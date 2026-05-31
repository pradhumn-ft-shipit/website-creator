-- ============================================================================
-- Basic Row-Level Security (PRD §10.3: "basic policies in v1, hardened in
-- v1.1"). Deny-by-default everywhere; owner-account read/write on the
-- user-facing tables. Internal/admin tables get RLS enabled with NO policy —
-- they are reachable only by the service_role key (which bypasses RLS), never
-- by an end user's anon/authenticated session.
--
-- Ownership model (v1, basic): public.users.id is assumed to equal auth.uid()
-- — the standard Supabase pattern of sharing the auth user id as the app user
-- id. Ticket 003 (auth) wires signup to mint public.users rows with that id.
-- Hardening (e.g. per-column policies, team-member sub-roles) is deferred.
-- ============================================================================

-- ---- ownership helpers ------------------------------------------------------
-- SECURITY DEFINER so the EXISTS lookups aren't themselves re-filtered by RLS,
-- which would otherwise recurse. STABLE: same result within a statement.

create or replace function public.owns_account(target_account_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.accounts a
    where a.id = target_account_id and a.user_id = auth.uid()
  );
$$;

create or replace function public.owns_order(target_order_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.orders o
    join public.accounts a on a.id = o.account_id
    where o.id = target_order_id and a.user_id = auth.uid()
  );
$$;

create or replace function public.owns_site(target_site_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.sites s
    join public.accounts a on a.id = s.account_id
    where s.id = target_site_id and a.user_id = auth.uid()
  );
$$;

-- ---- enable RLS on every table (deny-by-default once enabled) ----------------
alter table public.users                 enable row level security;
alter table public.accounts              enable row level security;
alter table public.orders                enable row level security;
alter table public.intake_data           enable row level security;
alter table public.generated_content     enable row level security;
alter table public.assets                enable row level security;
alter table public.team_members          enable row level security;
alter table public.sites                 enable row level security;
alter table public.deployments           enable row level security;
alter table public.edits                 enable row level security;
alter table public.leads                 enable row level security;
alter table public.compliance_rulesets   enable row level security;
alter table public.compliance_violations enable row level security;
alter table public.admin_alerts          enable row level security;
alter table public.email_log             enable row level security;
alter table public.waitlist              enable row level security;
alter table public.blog_posts            enable row level security;

-- ---- owner policies (user-facing tables) ------------------------------------
-- FOR ALL with both USING (read/update/delete visibility) and WITH CHECK
-- (insert/update row must remain owned). One policy per table in v1.

create policy users_self on public.users
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy accounts_owner on public.accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy orders_owner on public.orders
  for all using (public.owns_account(account_id)) with check (public.owns_account(account_id));

create policy intake_data_owner on public.intake_data
  for all using (public.owns_order(order_id)) with check (public.owns_order(order_id));

create policy generated_content_owner on public.generated_content
  for all using (public.owns_order(order_id)) with check (public.owns_order(order_id));

create policy assets_owner on public.assets
  for all using (public.owns_account(account_id)) with check (public.owns_account(account_id));

create policy team_members_owner on public.team_members
  for all using (public.owns_account(account_id)) with check (public.owns_account(account_id));

create policy sites_owner on public.sites
  for all using (public.owns_account(account_id)) with check (public.owns_account(account_id));

create policy deployments_owner on public.deployments
  for all using (public.owns_site(site_id)) with check (public.owns_site(site_id));

create policy edits_owner on public.edits
  for all using (public.owns_site(site_id)) with check (public.owns_site(site_id));

create policy leads_owner on public.leads
  for all using (public.owns_site(site_id)) with check (public.owns_site(site_id));

create policy blog_posts_owner on public.blog_posts
  for all using (public.owns_site(site_id)) with check (public.owns_site(site_id));

-- Internal/admin tables (compliance_rulesets, compliance_violations,
-- admin_alerts, email_log, waitlist) intentionally have NO policy: RLS is on,
-- so end-user sessions are denied; only the service_role key reaches them.
-- waitlist gets a public-insert policy in ticket 011 (public capture form).
