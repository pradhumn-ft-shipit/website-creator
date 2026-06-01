/**
 * Account settings IO (PRD §12.9). The single place the Settings tab talks to
 * Supabase. One account per user in v1, so every read/write is scoped to the
 * signed-in advisor's single `accounts` row (RLS enforces `user_id = auth.uid()`;
 * the `.eq("user_id", …)` filters just narrow to that one row). The pure
 * validators and `deletionState` derivation live in `settings.ts` and are reused
 * here. Email and password changes are *auth* concerns and go through
 * `lib/auth/service.ts` (Supabase Auth), not this table.
 */

import { redirect } from "next/navigation";

import { AppError } from "@/lib/api/envelope";
import { createClient } from "@/lib/supabase/server";
import {
  deletionState,
  isLeadFrequency,
  validateFirmName,
  validateFullName,
  type AccountSettings,
} from "./settings";

type AccountRow = {
  full_name: string | null;
  firm_name: string | null;
  lead_notification_frequency: string | null;
  system_alerts_enabled: boolean | null;
  deletion_requested_at: string | null;
};

/**
 * Resolve the signed-in advisor's settings (email from the auth session, the
 * rest from their account row). Redirects to /login if the session vanished;
 * throws if the row is somehow missing (the auth trigger guarantees one).
 */
export async function getAccountSettings(): Promise<AccountSettings> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("accounts")
    .select(
      "full_name, firm_name, lead_notification_frequency, system_alerts_enabled, deletion_requested_at",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error(`No account row for user ${user.id}`);

  const row = data as AccountRow;
  return {
    email: user.email ?? "",
    fullName: row.full_name ?? "",
    firmName: row.firm_name ?? "",
    notifications: {
      leadFrequency: isLeadFrequency(row.lead_notification_frequency)
        ? row.lead_notification_frequency
        : "instant",
      systemAlerts: row.system_alerts_enabled ?? true,
    },
    deletion: deletionState(row.deletion_requested_at, new Date()),
  };
}

/** Resolve the current user id or fail closed (the session is gone). */
async function currentUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AppError("Your session has expired.", "unauthorized", 401);
  return user.id;
}

export async function updateProfile(params: {
  fullName: string;
  firmName: string;
}): Promise<{ status: "saved" }> {
  const fullName = params.fullName.trim();
  const firmName = params.firmName.trim();
  const nameError = validateFullName(fullName) ?? validateFirmName(firmName);
  if (nameError) throw new AppError(nameError, "invalid_input", 400);

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  const { error } = await supabase
    .from("accounts")
    .update({ full_name: fullName || null, firm_name: firmName || null })
    .eq("user_id", userId);
  if (error) throw error;
  return { status: "saved" };
}

export async function updateNotificationPrefs(params: {
  leadFrequency: unknown;
  systemAlerts: unknown;
}): Promise<{ status: "saved" }> {
  if (!isLeadFrequency(params.leadFrequency)) {
    throw new AppError("Choose a valid lead-email frequency.", "invalid_input", 400);
  }
  const systemAlerts = Boolean(params.systemAlerts);

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  const { error } = await supabase
    .from("accounts")
    .update({
      lead_notification_frequency: params.leadFrequency,
      system_alerts_enabled: systemAlerts,
    })
    .eq("user_id", userId);
  if (error) throw error;
  return { status: "saved" };
}

/**
 * Begin the deletion grace window (PRD §12.9). Idempotent: requesting again
 * while already pending keeps the original timestamp (and thus the original
 * grace end), so a second click can't extend or reset the window. The actual
 * purge job is deferred (needs Inngest 009 + a cron — see ticket 027 decision);
 * this only records intent. Distinct from subscription cancellation.
 */
export async function requestAccountDeletion(): Promise<{
  status: "scheduled";
  graceEndsAt: string;
}> {
  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  const { data, error } = await supabase
    .from("accounts")
    .update({ deletion_requested_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("deletion_requested_at", null)
    .select("deletion_requested_at")
    .maybeSingle();
  if (error) throw error;

  // `data === null` means a deletion was already pending (the `is null` guard
  // matched nothing) — re-read the existing request time rather than overwriting it.
  const requestedAt =
    data?.deletion_requested_at ??
    (
      await supabase
        .from("accounts")
        .select("deletion_requested_at")
        .eq("user_id", userId)
        .single()
    ).data?.deletion_requested_at;

  const state = deletionState(requestedAt ?? null, new Date());
  if (!state.graceEndsAt) {
    throw new Error("Failed to schedule account deletion");
  }
  return { status: "scheduled", graceEndsAt: state.graceEndsAt };
}

/** Cancel a pending deletion (within the grace window). Idempotent. */
export async function cancelAccountDeletion(): Promise<{ status: "cancelled" }> {
  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  const { error } = await supabase
    .from("accounts")
    .update({ deletion_requested_at: null })
    .eq("user_id", userId);
  if (error) throw error;
  return { status: "cancelled" };
}
