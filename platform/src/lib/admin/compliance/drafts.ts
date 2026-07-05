/**
 * Ruleset draft persistence (PRD §5.7) — the IO edge for the working area where
 * a new ruleset version is authored + reviewed before publish.
 *
 * A draft holds the proposed rules.json / rules.md / manifest, an optional
 * research-agent proposal that seeded it, and an append-only `reviews_json`
 * sign-off log. The two-person publish gate (`publish.ts`) reads that log; this
 * module only records into it. All access is service-role (RLS-internal table).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { AppError } from "@/lib/api/envelope";
import type { Database } from "@/types/database.types";
import { createAdminClient } from "@/lib/supabase/admin";

import { checkTwoPersonApproval, type ApprovalCheck, type DraftReview } from "./publish";
import type { ResearchProposal } from "./research";

type AdminClient = SupabaseClient<Database>;

export interface CreateDraftInput {
  industry: string;
  subIndustry?: string | null;
  baseVersion: string | null;
  targetVersion: string;
  rulesJson?: unknown;
  rulesMarkdown?: string | null;
  manifestJson?: unknown;
  /** Cited proposal from the research agent that seeded this draft, if any. */
  research?: ResearchProposal | null;
  createdBy: string | null;
}

export interface DraftSummary {
  id: string;
  industry: string;
  subIndustry: string | null;
  baseVersion: string | null;
  targetVersion: string;
  status: string;
  reviews: DraftReview[];
  /** Two-person-gate status, computed server-side so client UI needs no server code. */
  approval: ApprovalCheck;
  hasResearch: boolean;
  createdAt: string;
  updatedAt: string;
}

function toReviews(raw: unknown): DraftReview[] {
  return Array.isArray(raw) ? (raw.filter((r) => r && typeof r === "object") as DraftReview[]) : [];
}

function toSummary(row: Record<string, unknown>): DraftSummary {
  const reviews = toReviews(row.reviews_json);
  return {
    id: row.id as string,
    industry: row.industry as string,
    subIndustry: (row.sub_industry ?? null) as string | null,
    baseVersion: (row.base_version ?? null) as string | null,
    targetVersion: row.target_version as string,
    status: row.status as string,
    reviews,
    approval: checkTwoPersonApproval(reviews),
    hasResearch: row.research_json != null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

const SUMMARY_SELECT =
  "id, industry, sub_industry, base_version, target_version, status, reviews_json, research_json, created_at, updated_at";

/** Create a new draft (optionally seeded by a research proposal). */
export async function createDraft(
  client: AdminClient,
  input: CreateDraftInput,
): Promise<DraftSummary> {
  const { data, error } = await client
    .from("compliance_ruleset_drafts")
    .insert({
      industry: input.industry,
      sub_industry: input.subIndustry ?? null,
      base_version: input.baseVersion,
      target_version: input.targetVersion,
      rules_json: (input.rulesJson ?? null) as Database["public"]["Tables"]["compliance_ruleset_drafts"]["Insert"]["rules_json"],
      rules_markdown: input.rulesMarkdown ?? null,
      manifest_json: (input.manifestJson ?? null) as Database["public"]["Tables"]["compliance_ruleset_drafts"]["Insert"]["manifest_json"],
      research_json: (input.research ?? null) as Database["public"]["Tables"]["compliance_ruleset_drafts"]["Insert"]["research_json"],
      status: "draft",
      created_by: input.createdBy,
    })
    .select(SUMMARY_SELECT)
    .single();

  if (error || !data) {
    throw new AppError("Failed to create the draft.", "draft_create_failed", 500);
  }
  return toSummary(data as Record<string, unknown>);
}

/** List drafts (newest first), optionally filtered by status. */
export async function listDrafts(
  client: AdminClient,
  opts: { status?: string } = {},
): Promise<DraftSummary[]> {
  let query = client
    .from("compliance_ruleset_drafts")
    .select(SUMMARY_SELECT)
    .order("created_at", { ascending: false });
  if (opts.status) query = query.eq("status", opts.status);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map(toSummary);
}

/**
 * Append a sign-off to a draft's review log (read-modify-write) and move it to
 * `in_review`. A person may only hold one active decision — a repeat sign-off by
 * the same reviewer+role replaces the prior one so the log never double-counts.
 */
export async function addReview(
  client: AdminClient,
  draftId: string,
  incoming: DraftReview,
): Promise<DraftSummary> {
  const { data: existing, error: readError } = await client
    .from("compliance_ruleset_drafts")
    .select("reviews_json, status")
    .eq("id", draftId)
    .maybeSingle();

  if (readError) throw new AppError("Failed to load the draft.", "draft_lookup_failed", 500);
  if (!existing) throw new AppError("Draft not found.", "draft_not_found", 404);
  const row = existing as { reviews_json: unknown; status: string };
  if (row.status === "published") {
    throw new AppError("Cannot review a published draft.", "already_published", 409);
  }

  const prior = toReviews(row.reviews_json).filter(
    (r) => !(r.reviewerId === incoming.reviewerId && r.role === incoming.role),
  );
  const reviews = [...prior, incoming];

  const { data, error } = await client
    .from("compliance_ruleset_drafts")
    .update({
      reviews_json: reviews as unknown as Database["public"]["Tables"]["compliance_ruleset_drafts"]["Update"]["reviews_json"],
      status: "in_review",
      updated_at: new Date().toISOString(),
    })
    .eq("id", draftId)
    .select(SUMMARY_SELECT)
    .single();

  if (error || !data) throw new AppError("Failed to record the sign-off.", "review_write_failed", 500);
  return toSummary(data as Record<string, unknown>);
}

// ---- wired entry points --------------------------------------------------

export function createDraftWithClient(input: CreateDraftInput) {
  return createDraft(createAdminClient(), input);
}

export function listDraftsWithClient(opts: { status?: string } = {}) {
  return listDrafts(createAdminClient(), opts);
}

export function addReviewWithClient(draftId: string, review: DraftReview) {
  return addReview(createAdminClient(), draftId, review);
}
