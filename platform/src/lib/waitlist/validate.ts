/**
 * Waitlist validation (PRD §2.2, ticket 011) — pure, client-safe. The four
 * non-RIA industry cards capture an email so we can sequence the next vertical
 * (§16.3: first to ~200 signups wins). RIA is excluded here because it's live,
 * not a waitlist.
 */
import { WAITLIST_INDUSTRIES } from "@/lib/onboarding/steps";

// Same pragmatic check as auth validation — keep the two in sync intentionally.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeWaitlistEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type WaitlistInput = { email: string; industry: string };

export function validateWaitlist({ email, industry }: WaitlistInput): string | null {
  if (!EMAIL_RE.test(email.trim())) return "Enter a valid email address.";
  if (!(WAITLIST_INDUSTRIES as readonly string[]).includes(industry)) {
    return "Pick a waitlist industry.";
  }
  return null;
}
