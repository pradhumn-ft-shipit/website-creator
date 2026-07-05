/**
 * `email_log` persistence (PRD §10.1, §9.4) — the audit trail every send writes
 * to and the webhook (`webhook.ts`) updates. `email_log` is an RLS-internal
 * table (002), so all access here is via the service-role client, same as
 * `lib/compliance/persistence.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { AppError } from "@/lib/api/envelope";
import type { Database } from "@/types/database.types";

type AdminClient = SupabaseClient<Database>;

/** The only statuses `email_log.status` accepts (002's CHECK constraint). */
export type EmailLogStatus = "sent" | "delivered" | "bounced" | "complained";

export interface WriteEmailLogInput {
  accountId?: string | null;
  template: string;
  recipient: string;
  resendMessageId: string;
}

/** Write the initial `sent` row right after Resend accepts a send. */
export async function writeEmailLog(
  client: AdminClient,
  input: WriteEmailLogInput,
): Promise<{ id: string }> {
  const { data, error } = await client
    .from("email_log")
    .insert({
      account_id: input.accountId ?? null,
      template: input.template,
      recipient: input.recipient,
      resend_message_id: input.resendMessageId,
      status: "sent",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new AppError("Failed to write the email log.", "email_log_write_failed", 500);
  }
  return { id: (data as { id: string }).id };
}

/**
 * Update a logged send's status from a Resend webhook event (§9.4). Looked up
 * by `resend_message_id` (there is exactly one log row per send). A `delivered`
 * transition also stamps `delivered_at`. Bounce/complaint are logged here and
 * ONLY here — CLAUDE.md's fallback rule is "log + surface, never blind-retry",
 * so this function deliberately never triggers another send.
 */
export async function updateEmailLogStatus(
  client: AdminClient,
  resendMessageId: string,
  status: EmailLogStatus,
): Promise<{ updated: boolean }> {
  const { data, error } = await client
    .from("email_log")
    .update({
      status,
      ...(status === "delivered" ? { delivered_at: new Date().toISOString() } : {}),
    })
    .eq("resend_message_id", resendMessageId)
    .select("id");

  if (error) {
    throw new AppError("Failed to update the email log.", "email_log_update_failed", 500);
  }
  return { updated: (data ?? []).length > 0 };
}
