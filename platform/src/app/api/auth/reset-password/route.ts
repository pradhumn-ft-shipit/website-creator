import { apiHandler } from "@/lib/api/envelope";
import { asString, readJson } from "@/lib/api/request";
import { requestPasswordReset } from "@/lib/auth/service";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/reset-password — { email }.
 * Sends a recovery link that returns through /api/auth/callback into the
 * update-password screen. Always reports "sent" for an unknown address (no
 * enumeration); only operational errors (rate limit) surface.
 */
export const POST = apiHandler(async (request) => {
  const body = await readJson(request);
  const origin = new URL(request.url).origin;
  const supabase = await createClient();

  return requestPasswordReset(supabase, {
    email: asString(body.email),
    redirectTo: `${origin}/api/auth/callback?next=/update-password`,
  });
});
