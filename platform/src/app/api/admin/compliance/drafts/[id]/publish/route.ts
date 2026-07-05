import { apiHandler } from "@/lib/api/envelope";
import { assertAdmin } from "@/lib/admin/auth";
import { publishDraftWired } from "@/lib/admin/compliance";

/**
 * POST /api/admin/compliance/drafts/:id/publish — publish a draft as a new
 * immutable ruleset version (PRD §5.7, §11.2 / two-person guardrail).
 *
 * The two-person gate is enforced inside `publishDraftWired`: it throws
 * `two_person_required` (409) unless a distinct drafter + approver have signed
 * off, so this route cannot publish an under-reviewed ruleset. On success it
 * writes the versioned artifacts, mirrors the DB row, and queues Layer-2
 * re-validation across affected sites.
 */
export const POST = apiHandler(async (_request, context) => {
  const admin = await assertAdmin();
  const { id } = await (context as { params: Promise<{ id: string }> }).params;
  return publishDraftWired({
    draftId: id,
    publisherId: admin.id,
    publisherEmail: admin.email ?? admin.id,
  });
});
