import { notFound, redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { AppError } from "@/lib/api/envelope";
import { getUser } from "@/lib/auth/session";

/**
 * Admin gate for the internal-only `/admin/*` surface (PRD §11).
 *
 * v1 identifies WRI team members by an env-var email allowlist (`ADMIN_EMAILS`,
 * comma/whitespace-separated) rather than a DB role — there is no admin-user
 * management UI in scope, the alpha team is tiny, and this keeps the gate
 * schema-free and deny-by-default (see state/decisions.md). Swapping to a DB
 * role later only touches `isAdminEmail`'s call sites, not the callers.
 *
 * The pure `isAdminEmail` carries the matching logic so it is exhaustively
 * unit-tested; the `requireAdmin` / `assertAdmin` wrappers are the thin IO
 * boundary (resolve the session, then apply the predicate).
 */

/** Parse `ADMIN_EMAILS` into a normalized (trimmed, lowercased) list. */
export function parseAdminAllowlist(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[\s,]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

/** True iff `email` is on the configured allowlist. Fails closed. */
export function isAdminEmail(
  email: string | null | undefined,
  allowlist: string | undefined,
): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  return parseAdminAllowlist(allowlist).includes(normalized);
}

/** Resolve the current user's admin status from the session + env allowlist. */
async function resolveAdmin(): Promise<{ user: User | null; isAdmin: boolean }> {
  const user = await getUser();
  return { user, isAdmin: isAdminEmail(user?.email, process.env.ADMIN_EMAILS) };
}

/**
 * Server-Component gate for `/admin/*` pages. Unauthenticated → /login;
 * authenticated-but-not-admin → 404 (least disclosure — a regular advisor never
 * learns the admin surface exists). Returns the admin user on success.
 */
export async function requireAdmin(): Promise<User> {
  const { user, isAdmin } = await resolveAdmin();
  if (!user) redirect("/login");
  if (!isAdmin) notFound();
  return user;
}

/**
 * Route-handler gate for `/api/admin/*`. Throws `AppError` (403) so the envelope
 * returns a clean error rather than a redirect/404. Returns the admin user.
 */
export async function assertAdmin(): Promise<User> {
  const { user, isAdmin } = await resolveAdmin();
  if (!user || !isAdmin) {
    throw new AppError("Admin access required.", "forbidden", 403);
  }
  return user;
}
