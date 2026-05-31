import { apiHandler } from "@/lib/api/envelope";
import { asString, readJson } from "@/lib/api/request";
import { updatePassword } from "@/lib/auth/service";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/update-password — { password }.
 * Requires the recovery session established by the callback after the user
 * clicks the emailed reset link (Supabase rejects updateUser without it).
 */
export const POST = apiHandler(async (request) => {
  const body = await readJson(request);
  const supabase = await createClient();

  return updatePassword(supabase, { password: asString(body.password) });
});
