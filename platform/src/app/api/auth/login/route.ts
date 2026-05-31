import { apiHandler } from "@/lib/api/envelope";
import { asString, readJson } from "@/lib/api/request";
import { signInAdvisor } from "@/lib/auth/service";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/login — { email, password }.
 * On success the server client writes the session cookies onto the response;
 * the client then navigates to the post-auth landing. Errors are deliberately
 * generic (no account-existence enumeration, §4.7) except the verify-first case.
 */
export const POST = apiHandler(async (request) => {
  const body = await readJson(request);
  const supabase = await createClient();

  return signInAdvisor(supabase, {
    email: asString(body.email),
    password: asString(body.password),
  });
});
