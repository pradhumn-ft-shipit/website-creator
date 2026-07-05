/**
 * Public surface of the `/admin/compliance` ruleset-management tool (PRD §5.7,
 * §11.2). The internal module split (versions / diff / research / drafts /
 * publish / revalidation / wiring) stays hidden behind this barrel.
 */

export {
  listRulesetVersions,
  listDiskRulesetVersions,
  countLiveSitesByVersion,
  flattenAffectedRows,
  shapeVersions,
  type RulesetVersionRow,
  type AffectedRow,
} from "./versions";

export {
  diffRulesets,
  DIFF_CATEGORIES,
  type RulesetDiff,
  type RuleChange,
  type DiffCategory,
  type ChangeKind,
} from "./diff";

export {
  runResearchAgent,
  parseResearchProposal,
  buildResearchPrompt,
  RESEARCH_PROPOSAL_SCHEMA,
  type ResearchProposal,
  type ProposedChange,
  type ResearchCitation,
  type ResearchContext,
} from "./research";

export {
  createDraft,
  listDrafts,
  addReview,
  createDraftWithClient,
  listDraftsWithClient,
  addReviewWithClient,
  type CreateDraftInput,
  type DraftSummary,
} from "./drafts";

export {
  checkTwoPersonApproval,
  assertTwoPersonApproval,
  computePublishReadiness,
  buildPublishedManifest,
  publishDraft,
  loadDraft,
  type DraftReview,
  type ReviewRole,
  type ReviewDecision,
  type ApprovalCheck,
  type PublishableDraft,
  type PublishReadiness,
  type PublishResult,
} from "./publish";

export {
  planRevalidation,
  recordRevalidationResult,
  type RevalidationTarget,
  type RevalidationOutcome,
} from "./revalidation";

export {
  publishDraftWired,
  runResearchAgentWired,
  complianceRoot,
  loadRulesetLinter,
  nodeArtifactWriter,
} from "./wiring";
