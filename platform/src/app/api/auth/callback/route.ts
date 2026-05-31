import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { apiHandler } from "@/lib/api/envelope";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/auth/callback — the single return point for every Supabase redirect:
 *   • Google OAuth and the PKCE email-confirmation link deliver `?code=…`
 *     → exchangeCodeForSession.
 *   • A `{{ .ConfirmationURL }}`-style template delivers `?token_hash=…&type=…`
 *     → verifyOtp.
 * Either way we establish the session cookies on the response, then redirect to
 * the (validated, same-origin) `next` target. Failures land on /login with a
 * non-alarming error flag rather than leaking provider detail.
 */

const OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "magiclink",
  "recovery",
  "invite",
  "email",
  "email_change",
]);

/** Only allow same-origin, single-leading-slash paths as a redirect target. */
function safeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/dashboard";
}

export const GET = apiHandler(async (request) => {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let failed = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failed = Boolean(error);
  } else if (tokenHash && type && OTP_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    failed = Boolean(error);
  } else {
    failed = true;
  }

  const destination = failed ? "/login?error=auth_callback" : next;
  return NextResponse.redirect(new URL(destination, url.origin));
});
