/**
 * Auth input validation — shared by the client (real-time inline validation,
 * PRD §7.6) and the server (defense-in-depth before hitting Supabase). Pure
 * functions returning a human-readable error string, or `null` when valid.
 */

export const MIN_PASSWORD_LENGTH = 8;

// Pragmatic single-`@`, non-empty-local, dotted-domain check. Deliberately not
// RFC 5322 — Supabase is the source of truth for deliverability; this only
// catches the obvious typos §7.6 asks us to flag before submit.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return "Enter your email address.";
  if (!EMAIL_RE.test(trimmed)) return "Enter a valid email address.";
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return "Enter a password.";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}
