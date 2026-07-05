import { apiHandler, AppError } from "@/lib/api/envelope";
import { asString, readJson } from "@/lib/api/request";
import { assertAdmin } from "@/lib/admin/auth";
import { addReviewWithClient, type DraftReview, type ReviewRole } from "@/lib/admin/compliance";

const ROLES = new Set<ReviewRole>(["drafter", "approver"]);

/**
 * POST /api/admin/compliance/drafts/:id/review — record a sign-off (PRD §5.7).
 * Admin-only. Body: { role: "drafter" | "approver", decision?, note? }. The
 * reviewer identity is the authenticated admin — a caller cannot sign off *as*
 * someone else, which is what makes the two-person publish gate meaningful.
 */
export const POST = apiHandler(async (request, context) => {
  const admin = await assertAdmin();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  const body = await readJson(request);

  const role = asString(body.role).trim() as ReviewRole;
  if (!ROLES.has(role)) {
    throw new AppError("role must be 'drafter' or 'approver'.", "invalid_input", 400);
  }
  const decision = asString(body.decision).trim() === "changes_requested" ? "changes_requested" : "signed_off";

  const review: DraftReview = {
    reviewerId: admin.id,
    reviewerEmail: admin.email ?? admin.id,
    role,
    decision,
    note: typeof body.note === "string" ? body.note : undefined,
    at: new Date().toISOString(),
  };

  const draft = await addReviewWithClient(id, review);
  return { draft };
});
