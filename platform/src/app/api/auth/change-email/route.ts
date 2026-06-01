import { apiHandler } from "@/lib/api/envelope";
import { asString, readJson } from "@/lib/api/request";
import { changeEmail } from "@/lib/auth/service";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/change-email — { email }.
 * Starts a login-email change (PRD §12.9). Supabase emails a confirmation link
 * to the new address; the change only lands once it's clicked (routed back
 * through /api/auth/callback into Settings). The old email stays active until then.
 */
export const POST = apiHandler(async (request) => {
  const body = await readJson(request);
  const origin = new URL(request.url).origin;
  const supabase = await createClient();

  return changeEmail(supabase, {
    email: asString(body.email),
    emailRedirectTo: `${origin}/api/auth/callback?next=/dashboard/settings`,
  });
});
