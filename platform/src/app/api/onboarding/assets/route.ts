import { apiHandler, AppError } from "@/lib/api/envelope";
import { uploadAssetsForUser, type AssetFileInput, type AssetKind } from "@/lib/intake";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/onboarding/assets — logo / team / office uploads (§4.1.11, §6.8).
 * Multipart form: repeated `files`, each paired with a `kind` (logo|team_photo|
 * office) and optional `name`/`title` for team photos.
 *
 * Ownership is enforced by the cookie-bound RLS client (it inserts the assets /
 * team_members rows, which the owner policies gate); the Storage write to the
 * private `site-assets` bucket runs on the service-role client — same split as
 * the docs-upload path (012), because the bucket has no per-object policy.
 */
export const POST = apiHandler(async (request: Request) => {
  const rls = await createClient();
  const {
    data: { user },
  } = await rls.auth.getUser();
  if (!user) throw new AppError("Please sign in to continue.", "unauthenticated", 401);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new AppError("Expected a multipart form upload.", "invalid_input", 400);
  }

  const entries = form.getAll("files");
  const kinds = form.getAll("kind");
  const names = form.getAll("name");
  const titles = form.getAll("title");

  const files: AssetFileInput[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!(entry instanceof File)) continue;
    const kind = asKind(kinds[i]);
    const file: AssetFileInput = {
      filename: entry.name,
      bytes: new Uint8Array(await entry.arrayBuffer()),
      kind,
    };
    if (kind === "team_photo") {
      file.teamMember = {
        name: typeof names[i] === "string" ? (names[i] as string) : undefined,
        title: typeof titles[i] === "string" ? (titles[i] as string) : undefined,
      };
    }
    files.push(file);
  }

  return uploadAssetsForUser({ rls: rls as never, admin: createAdminClient(), userId: user.id }, files);
});

function asKind(value: FormDataEntryValue | undefined): AssetKind {
  if (value === "logo" || value === "team_photo" || value === "office") return value;
  throw new AppError("Each file needs a valid kind (logo, team_photo, or office).", "invalid_asset_kind", 400);
}
