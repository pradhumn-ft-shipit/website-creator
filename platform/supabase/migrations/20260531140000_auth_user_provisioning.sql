-- ============================================================================
-- Auth user provisioning (ticket 003).
--
-- Supabase Auth owns the `auth.users` identity table. Our app data model
-- (PRD §10.1) keeps a *separate* `public.users` row whose id MUST equal
-- auth.uid() — that invariant is what every RLS owner policy in
-- 20260531131305_rls_policies.sql relies on ("public.users.id == auth.uid()").
--
-- Rather than mint the paired app rows from application code (which races,
-- can partially fail, and would have to be duplicated across the password and
-- OAuth paths), we provision them in the database with an AFTER INSERT trigger
-- on auth.users. This runs once, server-side, for EVERY signup path uniformly
-- (email/password, Google OAuth, admin-created), so the invariant can never be
-- skipped.
--
-- Provisioning creates two rows per new auth user (PRD §3.2 "one account =
-- one user in v1"):
--   * public.users    — the app identity (id mirrors auth.users.id)
--   * public.accounts  — the firm/account, defaulting industry='ria' (the only
--                        v1 industry). firm_name / sub_industry / state are
--                        filled later during onboarding (tickets 010/013).
--
-- A second trigger keeps public.users.email_verified_at in sync with
-- auth.users.email_confirmed_at, so the app's notion of "verified" tracks
-- Supabase's without the app having to write it on the verification callback.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- handle_new_user — mint the paired public.users + public.accounts rows.
-- SECURITY DEFINER so it runs as the function owner (postgres) and bypasses
-- RLS on public.users/public.accounts; the trigger fires inside Supabase Auth's
-- own transaction, where there is no end-user JWT to satisfy the owner policies.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, email_verified_at, google_oauth_id)
  values (
    new.id,
    new.email,
    new.email_confirmed_at,
    -- raw_app_meta_data.provider is 'google' for the OAuth path, 'email' otherwise.
    case when new.raw_app_meta_data ->> 'provider' = 'google'
         then new.raw_user_meta_data ->> 'sub'
         else null end
  )
  on conflict (id) do nothing;

  insert into public.accounts (user_id, industry)
  values (new.id, 'ria')
  on conflict do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- sync_user_email_verified — mirror auth.users.email_confirmed_at onto
-- public.users.email_verified_at when a user confirms their email. Fires only
-- when email_confirmed_at actually changes (not on every auth.users update).
-- ----------------------------------------------------------------------------
create or replace function public.sync_user_email_verified()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.users
     set email_verified_at = new.email_confirmed_at
   where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (new.email_confirmed_at is distinct from old.email_confirmed_at)
  execute function public.sync_user_email_verified();
