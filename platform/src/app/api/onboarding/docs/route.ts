import { apiHandler, AppError } from "@/lib/api/envelope";
import { uploadDocsForUser, type UploadFileInput } from "@/lib/intake";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/onboarding/docs — upload intake documents (PRD §4.2 no-site path,
 * §4.3 scrape-failure fallback). Multipart form with one or more `files`.
 *
 * Ownership is enforced via the cookie-bound RLS client (reads only the
 * advisor's own account/order); the Storage write runs on the service-role
 * client because the `intake-docs` bucket is private (012 migration). Accepts
 * PDF / DOCX / TXT / MD / PPTX (validated in `storeDocs`); stored paths are
 * appended to `intake_data.uploaded_doc_paths`. The advisor-facing upload UI is
 * ticket 013 — this is the backend surface it (and the §4.3 fallback) call.
 */
export const POST = apiHandler(async (request: Request) => {
  const rls = await createClient();
  const {
    data: { user },
  } = await rls.auth.getUser();
  if (!user) {
    throw new AppError("Please sign in to continue.", "unauthenticated", 401);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new AppError("Expected a multipart form upload.", "invalid_input", 400);
  }

  const files: UploadFileInput[] = [];
  for (const entry of form.getAll("files")) {
    if (entry instanceof File) {
      files.push({
        filename: entry.name,
        bytes: new Uint8Array(await entry.arrayBuffer()),
      });
    }
  }

  return uploadDocsForUser({
    rls: rls as never,
    admin: createAdminClient(),
    userId: user.id,
    files,
  });
});
