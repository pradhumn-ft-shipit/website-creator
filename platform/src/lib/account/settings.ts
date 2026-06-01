/**
 * Account settings (PRD §12.9) — the pure, client-safe core behind the dashboard
 * Settings tab: types, input validators, the notification-frequency set, and the
 * 30-day deletion-grace derivation. All unit-tested (settings.test.ts) and free
 * of any server-only import, so the client `SettingsForm` can pull the types and
 * `LEAD_FREQUENCIES` from here. The Supabase IO lives in `service.ts`.
 */

// ---- profile validation ----------------------------------------------------

const MAX_FULL_NAME = 120;
const MAX_FIRM_NAME = 200;

/** Person's display name — optional and clearable; only length-bounded. */
export function validateFullName(name: string): string | null {
  if (name.trim().length > MAX_FULL_NAME) {
    return `Use at most ${MAX_FULL_NAME} characters.`;
  }
  return null;
}

/** Firm name — optional and clearable; only length-bounded. */
export function validateFirmName(name: string): string | null {
  if (name.trim().length > MAX_FIRM_NAME) {
    return `Use at most ${MAX_FIRM_NAME} characters.`;
  }
  return null;
}

// ---- notification preferences ----------------------------------------------

/** Email cadence for new-lead notifications (PRD §12.9). */
export const LEAD_FREQUENCIES = ["instant", "daily", "off"] as const;
export type LeadFrequency = (typeof LEAD_FREQUENCIES)[number];

export function isLeadFrequency(value: unknown): value is LeadFrequency {
  return (
    typeof value === "string" &&
    (LEAD_FREQUENCIES as readonly string[]).includes(value)
  );
}

export type NotificationPrefs = {
  leadFrequency: LeadFrequency;
  systemAlerts: boolean;
};

// ---- account deletion grace window -----------------------------------------

/** Account deletion is reversible for this many days (PRD §12.9). */
export const DELETION_GRACE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export type DeletionState = {
  /** A deletion has been requested and the grace window hasn't been cancelled. */
  pending: boolean;
  /** ISO instant the data is purged after, or null when not pending. */
  graceEndsAt: string | null;
  /** Whole days left in the grace window (0 once elapsed), or null when not pending. */
  daysRemaining: number | null;
};

/**
 * Derive the deletion grace state from the stored request time. `now` is passed
 * in (never read ambiently) so this stays pure and testable. The window ends
 * exactly DELETION_GRACE_DAYS after the request; remaining days round *up* so the
 * count only reaches 0 at true expiry, and never goes negative afterwards.
 */
export function deletionState(
  requestedAt: string | null,
  now: Date,
): DeletionState {
  if (!requestedAt) {
    return { pending: false, graceEndsAt: null, daysRemaining: null };
  }
  const endsAt = new Date(
    new Date(requestedAt).getTime() + DELETION_GRACE_DAYS * DAY_MS,
  );
  const msLeft = endsAt.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msLeft / DAY_MS));
  return {
    pending: true,
    graceEndsAt: endsAt.toISOString(),
    daysRemaining,
  };
}

/** The full settings payload the dashboard tab renders (shared client + server). */
export type AccountSettings = {
  email: string;
  fullName: string;
  firmName: string;
  notifications: NotificationPrefs;
  deletion: DeletionState;
};
