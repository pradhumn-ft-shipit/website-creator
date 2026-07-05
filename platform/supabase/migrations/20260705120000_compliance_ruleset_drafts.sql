-- ============================================================================
-- 035 — /admin/compliance ruleset management (PRD §5.7, §11.2)
--
-- A working area for authoring the NEXT compliance ruleset version before it is
-- published. The published, immutable ruleset content stays on disk under
-- compliance/{industry}/v{N}/ (ticket 005) and is mirrored into
-- compliance_rulesets on publish; this table holds only *in-flight* drafts.
--
-- Two-person review (§5.7 / CLAUDE.md guardrail) is recorded in `reviews_json`
-- as an append-only list of sign-offs ({reviewer_id, reviewer_email, role,
-- decision, note, at}). Publishing is blocked in application code unless ≥2
-- distinct people have signed off (one drafter + one approver) — see
-- lib/admin/compliance/publish.ts (assertTwoPersonApproval).
--
-- Research-agent output (the cited diff proposal) is stored in `research_json`
-- so a scan result can seed a draft without ever auto-publishing.
-- ============================================================================

create table public.compliance_ruleset_drafts (
  id             uuid primary key default gen_random_uuid(),
  industry       text not null,
  sub_industry   text,
  -- Version this draft is based on ("1.0") and the version it will publish as
  -- ("1.1"). target_version is unique per (industry, sub_industry) among live
  -- drafts so two drafts can't race to the same version.
  base_version   text,
  target_version text not null,
  -- Authored content for the new version. rules_json/rules_markdown become the
  -- on-disk rules.json/rules.md; manifest_json seeds the published manifest.
  rules_json     jsonb,
  rules_markdown text,
  manifest_json  jsonb,
  -- The research agent's structured, cited diff proposal, if this draft was
  -- seeded from a scan (§5.7). Never itself a publish — advisory only.
  research_json  jsonb,
  -- Append-only sign-off log; the two-person gate reads this.
  reviews_json   jsonb not null default '[]'::jsonb,
  status         text not null default 'draft'
                   check (status in ('draft', 'in_review', 'published', 'rejected')),
  created_by     uuid references public.users (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  published_at   timestamptz,
  -- The compliance_rulesets row minted on publish (null until published).
  published_ruleset_id uuid references public.compliance_rulesets (id)
);

create index compliance_ruleset_drafts_status_idx
  on public.compliance_ruleset_drafts (status, created_at desc);

-- One open (non-published, non-rejected) draft per target version per industry.
create unique index compliance_ruleset_drafts_open_target_uniq
  on public.compliance_ruleset_drafts (industry, coalesce(sub_industry, ''), target_version)
  where status in ('draft', 'in_review');

-- Internal-only table: like compliance_rulesets, reachable solely via the
-- service_role key (which bypasses RLS). Enable RLS with no policies so any
-- end-user (anon/authenticated) session is denied by default (PRD §11 gate).
alter table public.compliance_ruleset_drafts enable row level security;
