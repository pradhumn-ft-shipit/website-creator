-- ============================================================================
-- Account settings — backing columns for the dashboard Settings tab (PRD §12.9).
--
-- Adds to `accounts`:
--   * full_name                  — advisor's display/profile name (firm_name
--                                  already exists; this is the person)
--   * lead_notification_frequency — email cadence for new-lead alerts
--   * system_alerts_enabled       — opt in/out of system/operational alerts
--   * deletion_requested_at       — start of the 30-day deletion grace window
--                                  (PRD §12.9; distinct from subscription
--                                  cancellation). NULL = no deletion pending.
--
-- No RLS change needed: the existing `accounts_owner` policy
-- (20260531131305_rls_policies.sql) is FOR ALL on `user_id = auth.uid()`, so the
-- advisor can already read/update these new columns on their own row. The actual
-- purge job (after the grace window) is deferred to Inngest + a cron (ticket 027
-- decision); this migration only records intent.
-- ============================================================================

alter table public.accounts
  add column full_name                   text,
  add column lead_notification_frequency text not null default 'instant'
    check (lead_notification_frequency in ('instant', 'daily', 'off')),
  add column system_alerts_enabled       boolean not null default true,
  add column deletion_requested_at       timestamptz;

-- Queried by the (future) purge cron to find accounts past their grace window.
create index accounts_deletion_requested_at_idx
  on public.accounts (deletion_requested_at)
  where deletion_requested_at is not null;
