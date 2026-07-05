/**
 * Ruleset publish workflow (PRD §5.7, §11.2 / CLAUDE.md two-person guardrail).
 *
 * The hard guardrail of the whole ticket: **a ruleset cannot be published
 * without two distinct sign-offs — one drafter and one approver.** That rule is
 * enforced here, in code, by `assertTwoPersonApproval`, and it is impossible to
 * reach the artifact write / DB insert without passing it.
 *
 * Split, as elsewhere, into a pure core (the gate + readiness computation,
 * exhaustively unit-tested) and one IO orchestrator (`publishDraft`) whose every
 * side-effecting boundary — disk writer, ruleset linter, service-role client,
 * event sender — is injected so it is testable without a filesystem, DB, or
 * Inngest.
 */

import { join } from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

import { AppError } from "@/lib/api/envelope";
import type { Database } from "@/types/database.types";
import { parseRulesJson, rulesetVersionString } from "@/lib/compliance";

type AdminClient = SupabaseClient<Database>;

// ---- reviews + the two-person gate (pure) --------------------------------

export type ReviewRole = "drafter" | "approver";
export type ReviewDecision = "signed_off" | "changes_requested";

/** One recorded sign-off on a draft (stored in the draft's `reviews_json`). */
export interface DraftReview {
  reviewerId: string;
  reviewerEmail: string;
  role: ReviewRole;
  decision: ReviewDecision;
  note?: string;
  at: string;
}

export interface ApprovalCheck {
  ok: boolean;
  /** Distinct people who signed off. */
  signers: string[];
  /** Human reasons the gate is not yet satisfied (empty when ok). */
  reasons: string[];
}

/**
 * The two-person invariant (§5.7). Publishing requires:
 *   1. a `drafter` sign-off,
 *   2. an `approver` sign-off,
 *   3. from two DIFFERENT people (a lone reviewer cannot self-approve).
 *
 * `changes_requested` reviews never count toward the gate. Returns a structured
 * result so the UI can show *why* publish is still blocked; `assert…` throws.
 */
export function checkTwoPersonApproval(reviews: DraftReview[]): ApprovalCheck {
  const signedOff = reviews.filter((r) => r.decision === "signed_off");
  const drafters = new Set(signedOff.filter((r) => r.role === "drafter").map((r) => r.reviewerId));
  const approvers = new Set(signedOff.filter((r) => r.role === "approver").map((r) => r.reviewerId));
  const signers = [...new Set(signedOff.map((r) => r.reviewerId))];

  const reasons: string[] = [];
  if (drafters.size === 0) reasons.push("A drafter must sign off.");
  if (approvers.size === 0) reasons.push("An approver must sign off.");
  // A distinct drafter + approver pair must exist (someone can't be both).
  const hasDistinctPair = [...drafters].some((d) => [...approvers].some((a) => a !== d));
  if (drafters.size > 0 && approvers.size > 0 && !hasDistinctPair) {
    reasons.push("The drafter and approver must be two different people.");
  }

  return { ok: reasons.length === 0, signers, reasons };
}

/** Throw a 409 `AppError` unless the two-person gate is satisfied. */
export function assertTwoPersonApproval(reviews: DraftReview[]): void {
  const check = checkTwoPersonApproval(reviews);
  if (!check.ok) {
    throw new AppError(
      `Two-person review required before publish: ${check.reasons.join(" ")}`,
      "two_person_required",
      409,
    );
  }
}

// ---- draft shape + readiness (pure) --------------------------------------

/** The subset of a draft row the publish core reasons about. */
export interface PublishableDraft {
  id: string;
  industry: string;
  subIndustry: string | null;
  baseVersion: string | null;
  targetVersion: string;
  rulesJson: unknown;
  rulesMarkdown: string | null;
  manifestJson: Record<string, unknown> | null;
  reviews: DraftReview[];
  status: string;
}

export interface PublishReadiness {
  ready: boolean;
  reasons: string[];
  approval: ApprovalCheck;
}

/**
 * Whether a draft is publishable right now: it is still open, names a target
 * version, carries parseable rule content + markdown, and clears the two-person
 * gate. (The full `lint:rulesets` pass runs against the written artifacts at
 * publish time — this is the pre-flight the UI shows.)
 */
export function computePublishReadiness(draft: PublishableDraft): PublishReadiness {
  const approval = checkTwoPersonApproval(draft.reviews);
  const reasons = [...approval.reasons];

  if (draft.status === "published") reasons.push("This draft is already published.");
  if (draft.status === "rejected") reasons.push("This draft was rejected.");
  if (!draft.targetVersion) reasons.push("A target version is required.");
  if (!draft.rulesMarkdown || draft.rulesMarkdown.trim() === "") {
    reasons.push("rules.md content is required.");
  }
  try {
    parseRulesJson(draft.rulesJson);
  } catch (err) {
    reasons.push(`rules.json is invalid: ${(err as Error).message}`);
  }

  return { ready: reasons.length === 0, reasons, approval };
}

// ---- publish orchestration (IO, injected boundaries) ---------------------

/** Filesystem boundary the publisher writes the new version through. */
export interface ArtifactWriter {
  exists(absPath: string): boolean;
  ensureDir(absPath: string): void;
  writeFile(absPath: string, content: string): void;
  /** Recursively copy a directory (used to carry disclosures from the base version). */
  copyDir(srcAbs: string, destAbs: string): void;
}

/** The `lint:rulesets` validator (005), run against the written version dir. */
export type RulesetLinter = (versionDir: string) => { ok: boolean; errors: string[] };

export interface RevalidationSender {
  send(event: {
    name: "compliance.revalidate";
    data: { industry: string; subIndustry: string | null; version: string; versionString: string };
  }): Promise<unknown>;
}

export interface PublishDeps {
  client: AdminClient;
  writer: ArtifactWriter;
  lint: RulesetLinter;
  send: RevalidationSender["send"];
  /** Absolute path to the repo `compliance/` root. */
  complianceRoot: string;
  now?: () => Date;
}

export interface PublishResult {
  versionString: string;
  rulesetId: string;
  revalidationQueued: boolean;
  reviewers: string[];
}

/** Build the published manifest from the draft's manifest + the sign-off record. */
export function buildPublishedManifest(
  draft: PublishableDraft,
  publisherEmail: string,
  publishedAt: string,
): Record<string, unknown> {
  const base = draft.manifestJson ? { ...draft.manifestJson } : {};
  const reviewers = [
    ...new Set(
      draft.reviews.filter((r) => r.decision === "signed_off").map((r) => r.reviewerEmail),
    ),
  ];
  return {
    ...base,
    industry: draft.industry,
    sub_industry: draft.subIndustry,
    version: draft.targetVersion,
    status: "approved",
    review: {
      two_person_required: true,
      approved: true,
      reviewers,
    },
    published_at: publishedAt,
    published_by: publisherEmail,
  };
}

/**
 * Publish a draft as a new immutable ruleset version (§5.7). In order:
 *   1. load the draft + enforce the two-person gate (throws otherwise),
 *   2. copy the base version's disclosures + write rules.json / rules.md /
 *      manifest.json to `compliance/{industry}/v{target}/`,
 *   3. run `lint:rulesets` on the written dir — refuse to publish an invalid
 *      ruleset (compliance guardrail),
 *   4. mirror the version into `compliance_rulesets` (the runtime lookup row),
 *   5. mark the draft published,
 *   6. enqueue Layer-2 re-validation across affected sites (034 seam).
 */
export async function publishDraft(
  deps: PublishDeps,
  args: { draftId: string; publisherId: string | null; publisherEmail: string },
): Promise<PublishResult> {
  const draft = await loadDraft(deps.client, args.draftId);

  // Hard gate — nothing below runs without two distinct sign-offs.
  assertTwoPersonApproval(draft.reviews);

  if (!draft.baseVersion) {
    throw new AppError("A draft must declare a base version to publish.", "no_base_version", 422);
  }
  // Validate rule content parses before touching disk (fail loud).
  parseRulesJson(draft.rulesJson);

  const publishedAt = (deps.now?.() ?? new Date()).toISOString();
  const versionDir = join(deps.complianceRoot, draft.industry, `v${draft.targetVersion}`);
  const baseDir = join(deps.complianceRoot, draft.industry, `v${draft.baseVersion}`);

  if (deps.writer.exists(versionDir)) {
    throw new AppError(
      `compliance/${draft.industry}/v${draft.targetVersion} already exists.`,
      "version_exists",
      409,
    );
  }

  // Carry the base version's disclosures forward, then overwrite rules + manifest.
  deps.writer.ensureDir(versionDir);
  deps.writer.copyDir(join(baseDir, "disclosures"), join(versionDir, "disclosures"));
  deps.writer.writeFile(
    join(versionDir, "rules.json"),
    `${JSON.stringify(draft.rulesJson, null, 2)}\n`,
  );
  deps.writer.writeFile(join(versionDir, "rules.md"), draft.rulesMarkdown ?? "");
  const manifest = buildPublishedManifest(draft, args.publisherEmail, publishedAt);
  deps.writer.writeFile(join(versionDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  // Compliance guardrail: never publish a ruleset that fails validation.
  const lintResult = deps.lint(versionDir);
  if (!lintResult.ok) {
    throw new AppError(
      `Published ruleset failed validation: ${lintResult.errors.join("; ")}`,
      "ruleset_invalid",
      422,
    );
  }

  const rulesetId = await insertRulesetRow(deps.client, {
    industry: draft.industry,
    subIndustry: draft.subIndustry,
    version: draft.targetVersion,
    rulesJson: draft.rulesJson,
    rulesMarkdown: draft.rulesMarkdown,
    publishedAt,
    publishedBy: args.publisherId,
  });

  await markDraftPublished(deps.client, draft.id, publishedAt, rulesetId);

  const versionString = rulesetVersionString(draft.industry, draft.targetVersion);
  await deps.send({
    name: "compliance.revalidate",
    data: {
      industry: draft.industry,
      subIndustry: draft.subIndustry,
      version: draft.targetVersion,
      versionString,
    },
  });

  return {
    versionString,
    rulesetId,
    revalidationQueued: true,
    reviewers: [
      ...new Set(draft.reviews.filter((r) => r.decision === "signed_off").map((r) => r.reviewerEmail)),
    ],
  };
}

// ---- DB IO (thin) --------------------------------------------------------

function toReviews(raw: unknown): DraftReview[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((r): r is DraftReview => !!r && typeof r === "object");
}

/** Read a draft row into the `PublishableDraft` shape (throws 404 on miss). */
export async function loadDraft(client: AdminClient, draftId: string): Promise<PublishableDraft> {
  const { data, error } = await client
    .from("compliance_ruleset_drafts")
    .select(
      "id, industry, sub_industry, base_version, target_version, rules_json, rules_markdown, manifest_json, reviews_json, status",
    )
    .eq("id", draftId)
    .maybeSingle();

  if (error) throw new AppError("Failed to load the draft.", "draft_lookup_failed", 500);
  if (!data) throw new AppError("Draft not found.", "draft_not_found", 404);

  const row = data as {
    id: string;
    industry: string;
    sub_industry: string | null;
    base_version: string | null;
    target_version: string;
    rules_json: unknown;
    rules_markdown: string | null;
    manifest_json: unknown;
    reviews_json: unknown;
    status: string;
  };
  if (row.status === "published") {
    throw new AppError("This draft is already published.", "already_published", 409);
  }
  return {
    id: row.id,
    industry: row.industry,
    subIndustry: row.sub_industry,
    baseVersion: row.base_version,
    targetVersion: row.target_version,
    rulesJson: row.rules_json,
    rulesMarkdown: row.rules_markdown,
    manifestJson: (row.manifest_json ?? null) as Record<string, unknown> | null,
    reviews: toReviews(row.reviews_json),
    status: row.status,
  };
}

async function insertRulesetRow(
  client: AdminClient,
  row: {
    industry: string;
    subIndustry: string | null;
    version: string;
    rulesJson: unknown;
    rulesMarkdown: string | null;
    publishedAt: string;
    publishedBy: string | null;
  },
): Promise<string> {
  const { data, error } = await client
    .from("compliance_rulesets")
    .insert({
      industry: row.industry,
      sub_industry: row.subIndustry,
      version: row.version,
      rules_json: row.rulesJson as Database["public"]["Tables"]["compliance_rulesets"]["Insert"]["rules_json"],
      rules_markdown: row.rulesMarkdown,
      published_at: row.publishedAt,
      published_by: row.publishedBy,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new AppError("Failed to record the published ruleset.", "ruleset_insert_failed", 500);
  }
  return (data as { id: string }).id;
}

async function markDraftPublished(
  client: AdminClient,
  draftId: string,
  publishedAt: string,
  rulesetId: string,
): Promise<void> {
  const { error } = await client
    .from("compliance_ruleset_drafts")
    .update({
      status: "published",
      published_at: publishedAt,
      published_ruleset_id: rulesetId,
      updated_at: publishedAt,
    })
    .eq("id", draftId);
  if (error) {
    throw new AppError("Failed to finalize the draft.", "draft_update_failed", 500);
  }
}
