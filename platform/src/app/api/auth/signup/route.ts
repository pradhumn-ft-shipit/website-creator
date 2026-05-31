import { apiHandler } from "@/lib/api/envelope";
import { asString, readJson } from "@/lib/api/request";
import { signUpAdvisor } from "@/lib/auth/service";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/signup — { email, password }.
 * Creates the auth user (the DB trigger mints the paired public.users +
 * accounts rows) and sends Supabase's verification email. Returns the §4.7
 * discriminator so the UI can branch: a verification screen vs. the neutral
 * "you already have an account" message.
 */
export const POST = apiHandler(async (request) => {
  const body = await readJson(request);
  const origin = new URL(request.url).origin;
  const supabase = await createClient();

  return signUpAdvisor(supabase, {
    email: asString(body.email),
    password: asString(body.password),
    emailRedirectTo: `${origin}/api/auth/callback?next=${encodeURIComponent("/dashboard?verified=1")}`,
  });
});
