import { apiHandler, AppError } from "@/lib/api/envelope";
import { asString, readJson } from "@/lib/api/request";
import { assertAdmin } from "@/lib/admin/auth";
import { createDraftWithClient, type ResearchProposal } from "@/lib/admin/compliance";
import { ACTIVE_RIA_INDUSTRY, ACTIVE_RIA_VERSION } from "@/lib/compliance";

/**
 * POST /api/admin/compliance/drafts — create a new ruleset draft (PRD §5.7).
 * Admin-only. Body: { targetVersion, baseVersion?, industry?, rulesJson?,
 * rulesMarkdown?, manifestJson?, research? }. A draft is the authoring +
 * two-person-review working area; publishing is a separate, gated step.
 */
export const POST = apiHandler(async (request) => {
  const admin = await assertAdmin();
  const body = await readJson(request);

  const targetVersion = asString(body.targetVersion).trim();
  if (!targetVersion) {
    throw new AppError("A target version is required.", "invalid_input", 400);
  }

  const draft = await createDraftWithClient({
    industry: asString(body.industry).trim() || ACTIVE_RIA_INDUSTRY,
    baseVersion: asString(body.baseVersion).trim() || ACTIVE_RIA_VERSION,
    targetVersion,
    rulesJson: body.rulesJson ?? null,
    rulesMarkdown: typeof body.rulesMarkdown === "string" ? body.rulesMarkdown : null,
    manifestJson: body.manifestJson ?? null,
    research: (body.research ?? null) as ResearchProposal | null,
    createdBy: admin.id,
  });

  return { draft };
});
