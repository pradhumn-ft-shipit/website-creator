import { apiHandler } from "@/lib/api/envelope";
import { asString, readJson } from "@/lib/api/request";
import { updateProfile } from "@/lib/account/service";

/**
 * POST /api/account/profile — { fullName, firmName }.
 * Updates the signed-in advisor's display name and firm name (PRD §12.9).
 * RLS scopes the write to their own account row.
 */
export const POST = apiHandler(async (request) => {
  const body = await readJson(request);
  return updateProfile({
    fullName: asString(body.fullName),
    firmName: asString(body.firmName),
  });
});
