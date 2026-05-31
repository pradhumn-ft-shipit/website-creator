/**
 * Auth service — the single place advisor authentication talks to Supabase Auth.
 *
 * Route handlers stay thin: they parse the request, call one of these functions,
 * and let `apiHandler` shape the `{data,error}` envelope. All Supabase error
 * translation, the §4.7 duplicate-email rule, and input validation live here so
 * the rules are tested once (service.test.ts) instead of per route.
 *
 * The functions take an `AuthClient` — structurally a Supabase client's `.auth`
 * surface — so tests inject a stub and production passes the cookie-bound
 * server client from `@/lib/supabase/server`. Email verification currently uses
 * Supabase's built-in sender; ticket 004 swaps the templates to Resend (the
 * emailRedirectTo seam already points at our own callback, so only the sender
 * changes).
 */

import { AppError } from "@/lib/api/envelope";
import { validateEmail, validatePassword } from "./validation";

type AuthErrorLike = { message: string; status?: number; code?: string };

type AuthResult<T> = Promise<{ data: T; error: AuthErrorLike | null }>;

/** The slice of the Supabase auth client this service depends on. */
export interface AuthClient {
  auth: {
    signUp(args: {
      email: string;
      password: string;
      options?: { emailRedirectTo?: string };
    }): AuthResult<{ user: { id: string; identities?: unknown[] | null } | null }>;
    signInWithPassword(args: {
      email: string;
      password: string;
    }): AuthResult<{ user: { id: string } | null }>;
    signOut(): Promise<{ error: AuthErrorLike | null }>;
    resetPasswordForEmail(
      email: string,
      options?: { redirectTo?: string },
    ): AuthResult<unknown>;
    updateUser(args: { password: string }): AuthResult<{
      user: { id: string } | null;
    }>;
  };
}

/** Translate an operational Supabase auth error into an envelope-friendly AppError. */
function mapAuthError(error: AuthErrorLike): never {
  if (error.status === 429 || error.code === "over_email_send_rate_limit") {
    throw new AppError(
      "Too many attempts. Please wait a moment and try again.",
      "rate_limited",
      429,
    );
  }
  if (error.status === 422) {
    throw new AppError(
      "Please check your details and try again.",
      "invalid_input",
      422,
    );
  }
  // Anything else is unexpected — let apiHandler return an opaque 500 rather
  // than leaking a raw provider message.
  throw new Error(`Unexpected Supabase auth error: ${error.message}`);
}

function assertValid(message: string | null): void {
  if (message) throw new AppError(message, "invalid_input", 400);
}

export type SignUpResult = { status: "verification_sent" | "already_registered" };

export async function signUpAdvisor(
  client: AuthClient,
  params: { email: string; password: string; emailRedirectTo: string },
): Promise<SignUpResult> {
  assertValid(validateEmail(params.email));
  assertValid(validatePassword(params.password));

  const { data, error } = await client.auth.signUp({
    email: params.email.trim(),
    password: params.password,
    options: { emailRedirectTo: params.emailRedirectTo },
  });
  if (error) mapAuthError(error);

  // §4.7: Supabase obfuscates duplicate signups — it returns a user object with
  // an empty `identities` array and no error. We surface the neutral
  // "you already have an account" path without confirming the account's state.
  const identities = data.user?.identities;
  if (data.user && Array.isArray(identities) && identities.length === 0) {
    return { status: "already_registered" };
  }
  return { status: "verification_sent" };
}

export async function signInAdvisor(
  client: AuthClient,
  params: { email: string; password: string },
): Promise<{ userId: string }> {
  assertValid(validateEmail(params.email));
  if (!params.password) {
    throw new AppError("Enter your password.", "invalid_input", 400);
  }

  const { data, error } = await client.auth.signInWithPassword({
    email: params.email.trim(),
    password: params.password,
  });

  if (error) {
    if (
      error.code === "email_not_confirmed" ||
      /not confirmed/i.test(error.message)
    ) {
      throw new AppError(
        "Please verify your email before signing in. Check your inbox for the verification link.",
        "email_not_confirmed",
        403,
      );
    }
    // Generic on purpose — never reveal whether the email exists (§4.7).
    throw new AppError(
      "That email or password is incorrect.",
      "invalid_credentials",
      401,
    );
  }

  if (!data.user) {
    throw new AppError(
      "That email or password is incorrect.",
      "invalid_credentials",
      401,
    );
  }
  return { userId: data.user.id };
}

export async function requestPasswordReset(
  client: AuthClient,
  params: { email: string; redirectTo: string },
): Promise<{ status: "sent" }> {
  assertValid(validateEmail(params.email));

  const { error } = await client.auth.resetPasswordForEmail(params.email.trim(), {
    redirectTo: params.redirectTo,
  });
  // resetPasswordForEmail already succeeds for unknown addresses, so any error
  // here is operational (rate limit, outage) — map it; it can't enumerate users.
  if (error) mapAuthError(error);
  return { status: "sent" };
}

export async function updatePassword(
  client: AuthClient,
  params: { password: string },
): Promise<{ status: "updated" }> {
  assertValid(validatePassword(params.password));

  const { error } = await client.auth.updateUser({ password: params.password });
  if (error) mapAuthError(error);
  return { status: "updated" };
}

export async function signOutAdvisor(
  client: AuthClient,
): Promise<{ status: "signed_out" }> {
  const { error } = await client.auth.signOut();
  if (error) mapAuthError(error);
  return { status: "signed_out" };
}
