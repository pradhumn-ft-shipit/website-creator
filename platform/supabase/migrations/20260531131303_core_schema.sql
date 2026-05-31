-- ============================================================================
-- WRI core schema — the v1 data-model spine (PRD §10.1).
--
-- Source of truth for the schema (CLAUDE.md: "Schema source of truth =
-- Supabase migrations"). All 17 §10.1 tables, with the enum-like `text`
-- status columns expressed as CHECK constraints so the closed value sets in
-- the PRD are enforced at the DB level.
--
-- Design decisions honored (PRD §10.2):
--   * accounts separate from users (multi-user firms in v1.5 w/o migration)
--   * generated_content is versioned, never destructively updated
--   * sites.current_content_version pointer to the live version
--   * assets.in_use_locations_json + assets.replaced_from_id audit chain
--   * admin_alerts is the /admin/orders queue
--   * compliance_rulesets versioned; DB records which version a site used
--
-- Deferred (PRD §10.3 — do NOT add here): UTM/referral tracking, hardened
-- RLS (basic policies live in the companion 20260531131305_rls_policies.sql),
-- a dedicated admin audit-log table.
-- ============================================================================

-- gen_random_uuid() lives in pgcrypto; present by default on Supabase, but be explicit.
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- users — login identities
-- ----------------------------------------------------------------------------
create table public.users (
  id                uuid primary key default gen_random_uuid(),
  email             text unique not null,
  password_hash     text,
  email_verified_at timestamptz,
  google_oauth_id   text,
  created_at        timestamptz not null default now(),
  last_login_at     timestamptz
);

-- ----------------------------------------------------------------------------
-- accounts — firms (one user in v1; future-proofed for multi-user teams)
-- ----------------------------------------------------------------------------
create table public.accounts (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.users (id) on delete cascade,
  firm_name              text,
  industry               text not null default 'ria',
  sub_industry           text check (sub_industry in ('ria_sec', 'ria_state')),
  primary_state          text,
  crd_number             text,
  stripe_customer_id     text,
  stripe_subscription_id text,
  subscription_status    text check (subscription_status in (
                           'trialing', 'active', 'pending_cancellation', 'cancelled', 'past_due')),
  plan                   text check (plan in ('monthly', 'annual')),
  created_at             timestamptz not null default now()
);
create index accounts_user_id_idx on public.accounts (user_id);

-- ----------------------------------------------------------------------------
-- orders — one per website build. status = order state machine (PRD §18.1).
-- The state-machine transitions/guards are owned by ticket 009; this column
-- just enforces the closed set of valid states.
-- ----------------------------------------------------------------------------
create table public.orders (
  id                     uuid primary key default gen_random_uuid(),
  account_id             uuid not null references public.accounts (id) on delete cascade,
  status                 text not null default 'payment_received' check (status in (
                           'payment_received',
                           'scraping', 'scrape_failed', 'docs_upload_fallback', 'scrape_complete',
                           'onboarding_in_progress', 'onboarding_complete',
                           'generating_copy', 'generation_failed',
                           'copy_review', 'revision_requested', 'copy_approved',
                           'compliance_review_layer2', 'compliance_review_failed',
                           'compliance_review_layer3', 'admin_review_required',
                           'building', 'build_failed',
                           'deploying', 'deploy_failed',
                           'deployed', 'email_sent', 'live', 'dns_monitoring',
                           'admin_queue')),
  state_machine_position text,
  failure_reason         text,
  retry_count            int not null default 0,
  created_at             timestamptz not null default now(),
  completed_at           timestamptz
);
create index orders_account_id_idx on public.orders (account_id);
create index orders_status_idx on public.orders (status);

-- ----------------------------------------------------------------------------
-- intake_data — captured during onboarding (one per order)
-- ----------------------------------------------------------------------------
create table public.intake_data (
  id                     uuid primary key default gen_random_uuid(),
  order_id               uuid not null references public.orders (id) on delete cascade,
  existing_site_url      text,
  scrape_result_json     jsonb,
  uploaded_doc_paths     text[],
  structured_intake_json jsonb
);
create index intake_data_order_id_idx on public.intake_data (order_id);

-- ----------------------------------------------------------------------------
-- generated_content — versioned per page/section. APPEND-ONLY: a new version
-- is a new row; existing rows are never destructively updated (PRD §10.2).
-- The only permitted mutation is recording approval. Enforced by trigger below.
-- ----------------------------------------------------------------------------
create table public.generated_content (
  id                      uuid primary key default gen_random_uuid(),
  order_id                uuid not null references public.orders (id) on delete cascade,
  version                 int not null default 1,
  page                    text not null,
  section                 text,
  content_json            jsonb,
  confidence_score        numeric(3,2),
  compliance_version_used text,
  generated_at            timestamptz not null default now(),
  approved_at             timestamptz,
  approved_by             uuid references public.users (id)
);
create index generated_content_order_id_idx on public.generated_content (order_id);
create unique index generated_content_version_uniq
  on public.generated_content (order_id, version, page, coalesce(section, ''));

-- ----------------------------------------------------------------------------
-- assets — uploaded files; replaced_from_id is the replacement audit chain
-- ----------------------------------------------------------------------------
create table public.assets (
  id                    uuid primary key default gen_random_uuid(),
  account_id            uuid not null references public.accounts (id) on delete cascade,
  type                  text not null check (type in (
                          'logo', 'team_photo', 'office', 'doc_adv', 'doc_crs', 'doc_other', 'ai_generated')),
  storage_path          text not null,
  original_filename     text,
  in_use_locations_json jsonb,
  metadata_json         jsonb,
  uploaded_at           timestamptz not null default now(),
  replaced_from_id      uuid references public.assets (id)
);
create index assets_account_id_idx on public.assets (account_id);

-- ----------------------------------------------------------------------------
-- team_members — reorderable, photo-linked
-- ----------------------------------------------------------------------------
create table public.team_members (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid not null references public.accounts (id) on delete cascade,
  name           text,
  title          text,
  designations   text[],
  bio            text,
  photo_asset_id uuid references public.assets (id) on delete set null,
  linkedin_url   text,
  order_index    int not null default 0
);
create index team_members_account_id_idx on public.team_members (account_id);

-- ----------------------------------------------------------------------------
-- sites — one per account in v1
-- ----------------------------------------------------------------------------
create table public.sites (
  id                        uuid primary key default gen_random_uuid(),
  account_id                uuid not null references public.accounts (id) on delete cascade,
  template_id               text check (template_id in ('trust', 'modern', 'boutique')),
  github_repo_url           text,
  vercel_project_id         text,
  vercel_default_url        text,
  custom_domain             text,
  custom_domain_verified_at timestamptz,
  current_content_version   int,
  last_deployed_at          timestamptz
);
create index sites_account_id_idx on public.sites (account_id);

-- ----------------------------------------------------------------------------
-- deployments — every Vercel deploy
-- ----------------------------------------------------------------------------
create table public.deployments (
  id                      uuid primary key default gen_random_uuid(),
  site_id                 uuid not null references public.sites (id) on delete cascade,
  content_version         int,
  vercel_deployment_id    text,
  status                  text check (status in ('building', 'ready', 'error')),
  triggered_by            text check (triggered_by in ('system', 'edit_chat', 'admin')),
  compliance_check_passed boolean,
  deployed_at             timestamptz
);
create index deployments_site_id_idx on public.deployments (site_id);

-- ----------------------------------------------------------------------------
-- edits — post-launch chat changes
-- ----------------------------------------------------------------------------
create table public.edits (
  id                        uuid primary key default gen_random_uuid(),
  site_id                   uuid not null references public.sites (id) on delete cascade,
  user_id                   uuid references public.users (id) on delete set null,
  page                      text,
  section                   text,
  before_json               jsonb,
  after_json                jsonb,
  ai_reasoning              text,
  compliance_recheck_result jsonb,
  deployed_in_deployment_id uuid references public.deployments (id) on delete set null,
  user_message              text,
  created_at                timestamptz not null default now()
);
create index edits_site_id_idx on public.edits (site_id);

-- ----------------------------------------------------------------------------
-- leads — captured from generated-site contact forms
-- ----------------------------------------------------------------------------
create table public.leads (
  id               uuid primary key default gen_random_uuid(),
  site_id          uuid not null references public.sites (id) on delete cascade,
  name             text,
  email            text,
  phone            text,
  message          text,
  source_page      text,
  turnstile_passed boolean,
  status           text not null default 'new' check (status in ('new', 'viewed', 'archived')),
  received_at      timestamptz not null default now()
);
create index leads_site_id_idx on public.leads (site_id);

-- ----------------------------------------------------------------------------
-- compliance_rulesets — versioned DB mirror of the repo ruleset artifacts.
-- Source of truth for rule *content* is the versioned files under compliance/
-- (ticket 005). Rows are immutable except published_at / retired_at lifecycle
-- columns; a new ruleset version is a new row. Enforced by trigger below.
-- ----------------------------------------------------------------------------
create table public.compliance_rulesets (
  id             uuid primary key default gen_random_uuid(),
  industry       text not null,
  sub_industry   text,
  version        text not null,
  rules_json     jsonb,
  rules_markdown text,
  published_at   timestamptz,
  published_by   uuid references public.users (id),
  retired_at     timestamptz
);
create unique index compliance_rulesets_version_uniq
  on public.compliance_rulesets (industry, coalesce(sub_industry, ''), version);

-- ----------------------------------------------------------------------------
-- compliance_violations — manual review queue
-- ----------------------------------------------------------------------------
create table public.compliance_violations (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid references public.orders (id) on delete cascade,
  edit_id               uuid references public.edits (id) on delete cascade,
  ruleset_version       text,
  severity              text check (severity in ('low', 'medium', 'high')),
  field_path            text,
  violation_description text,
  resolved_at           timestamptz,
  resolved_by           uuid references public.users (id),
  resolution_action     text check (resolution_action in (
                          'approved', 'edited', 'regenerated', 'rejected'))
);
create index compliance_violations_order_id_idx on public.compliance_violations (order_id);

-- ----------------------------------------------------------------------------
-- admin_alerts — internal dashboard inbox; /admin/orders reads from this
-- ----------------------------------------------------------------------------
create table public.admin_alerts (
  id              uuid primary key default gen_random_uuid(),
  type            text check (type in ('order_failed', 'compliance_review', 'manual_intervention')),
  order_id        uuid references public.orders (id) on delete cascade,
  site_id         uuid references public.sites (id) on delete cascade,
  payload_json    jsonb,
  acknowledged_at timestamptz,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index admin_alerts_unresolved_idx on public.admin_alerts (created_at) where resolved_at is null;

-- ----------------------------------------------------------------------------
-- email_log — every Resend send (deliverability + lead-notification audit)
-- ----------------------------------------------------------------------------
create table public.email_log (
  id                uuid primary key default gen_random_uuid(),
  account_id        uuid references public.accounts (id) on delete set null,
  template          text,
  recipient         text,
  resend_message_id text,
  status            text check (status in ('sent', 'delivered', 'bounced', 'complained')),
  sent_at           timestamptz not null default now(),
  delivered_at      timestamptz
);
create index email_log_account_id_idx on public.email_log (account_id);

-- ----------------------------------------------------------------------------
-- waitlist — the four non-RIA industries (PRD §2.2)
-- ----------------------------------------------------------------------------
create table public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  industry   text check (industry in ('insurance', 'mortgage', 'law', 'real_estate')),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- blog_posts — advisor-uploaded markdown
-- ----------------------------------------------------------------------------
create table public.blog_posts (
  id                      uuid primary key default gen_random_uuid(),
  site_id                 uuid not null references public.sites (id) on delete cascade,
  title                   text,
  slug                    text,
  markdown_content        text,
  compliance_check_result jsonb,
  status                  text not null default 'pending_review' check (status in (
                            'pending_review', 'approved', 'published', 'rejected')),
  published_at            timestamptz,
  uploaded_at             timestamptz not null default now()
);
create index blog_posts_site_id_idx on public.blog_posts (site_id);

-- ============================================================================
-- Non-destructive-update guards (PRD §10.2: content is versioned, never
-- destructively updated). These make the "no destructive-update path exists"
-- acceptance criterion a hard DB guarantee, not just a convention.
-- ============================================================================

-- generated_content: a row's content is immutable once written. The only
-- permitted UPDATE is recording approval (approved_at / approved_by). Any new
-- content is a new version row, not an in-place edit.
create or replace function public.guard_generated_content_immutable()
returns trigger language plpgsql as $$
begin
  if new.order_id is distinct from old.order_id
     or new.version is distinct from old.version
     or new.page is distinct from old.page
     or new.section is distinct from old.section
     or new.content_json is distinct from old.content_json
     or new.confidence_score is distinct from old.confidence_score
     or new.compliance_version_used is distinct from old.compliance_version_used
     or new.generated_at is distinct from old.generated_at then
    raise exception
      'generated_content is append-only: create a new version row instead of editing %', old.id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger generated_content_immutable
  before update on public.generated_content
  for each row execute function public.guard_generated_content_immutable();

-- compliance_rulesets: a published ruleset version is immutable. Only the
-- lifecycle columns (published_at, published_by, retired_at) may change; a new
-- ruleset version is a new row.
create or replace function public.guard_compliance_ruleset_immutable()
returns trigger language plpgsql as $$
begin
  if new.industry is distinct from old.industry
     or new.sub_industry is distinct from old.sub_industry
     or new.version is distinct from old.version
     or new.rules_json is distinct from old.rules_json
     or new.rules_markdown is distinct from old.rules_markdown then
    raise exception
      'compliance_rulesets is immutable per version: publish a new version row instead of editing %', old.id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger compliance_rulesets_immutable
  before update on public.compliance_rulesets
  for each row execute function public.guard_compliance_ruleset_immutable();