-- ============================================================================
-- order_state_events — append-only order state-transition log (PRD §11.1, §18.1)
--
-- 009's state machine (transitionOrder) only overwrites orders.status +
-- state_machine_position; it keeps NO history of how an order moved through the
-- pipeline. The admin order detail view (§11.1 "full state-machine history",
-- ticket 033 Slice 2) needs that timeline, and the table also yields a precise
-- "time in current state" (now − the latest event's occurred_at) — superseding
-- the approximate measure 033 Slice 1 derived from the failure alert.
--
-- One row is written on every successful transition (transitionOrder) and on an
-- admin retry reset (note = 'admin retry'). Internal/operational table — like
-- admin_alerts it is reached ONLY by the service_role key, so RLS is enabled
-- with no policy (deny-by-default to any end-user session). It is intentionally
-- NOT part of the §10.1 core data model (no entry in PUBLIC_TABLES); it is an
-- audit log added alongside the admin tooling.
-- ============================================================================

create table public.order_state_events (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  from_status text,                      -- null only for a synthetic initial state
  to_status   text not null,
  occurred_at timestamptz not null default now(),
  note        text                       -- e.g. 'admin retry', or the failing step
);

create index order_state_events_order_id_idx
  on public.order_state_events (order_id, occurred_at);

-- Internal table: RLS on, NO policy → only the service_role key reaches it
-- (same posture as admin_alerts / compliance_violations).
alter table public.order_state_events enable row level security;
