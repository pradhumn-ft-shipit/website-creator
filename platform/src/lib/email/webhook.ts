/**
 * Resend webhook handling (PRD §9.4) — the async half of the audit trail.
 * Resend POSTs delivery events (sent/delivered/bounced/complained/…) signed
 * with Svix; we verify the signature, map the event to an `email_log.status`
 * transition, and apply it. Bounce/complaint are terminal here — CLAUDE.md's
 * fallback rule is "log + surface, never blind-retry", so this module has no
 * retry path; it only ever calls `updateEmailLogStatus`.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import { updateEmailLogStatus, type EmailLogStatus } from "./log";

type AdminClient = SupabaseClient<Database>;

export interface WebhookSignatureHeaders {
  id: string;
  timestamp: string;
  /** Space-separated `v1,<base64sig>` pairs — Resend may send more than one. */
  signature: string;
}

/**
 * Verify a Resend (Svix-signed) webhook. `secret` is the `whsec_...` value from
 * the Resend dashboard. Returns false on any malformed input rather than
 * throwing, so callers can respond 401 uniformly.
 */
export function verifyWebhookSignature(
  secret: string,
  headers: WebhookSignatureHeaders,
  rawBody: string,
): boolean {
  try {
    const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
    const signedContent = `${headers.id}.${headers.timestamp}.${rawBody}`;
    const expected = createHmac("sha256", secretBytes).update(signedContent).digest();

    return headers.signature
      .split(" ")
      .map((part) => part.split(",")[1])
      .filter((sig): sig is string => Boolean(sig))
      .some((sig) => {
        try {
          const provided = Buffer.from(sig, "base64");
          return provided.length === expected.length && timingSafeEqual(provided, expected);
        } catch {
          return false;
        }
      });
  } catch {
    return false;
  }
}

/** The subset of Resend event types that map to an `email_log` status. */
const EVENT_STATUS: Record<string, EmailLogStatus> = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
};

export interface ResendWebhookEvent {
  type: string;
  data: { email_id?: string };
}

export interface ApplyEventResult {
  /** True if the event mapped to a status and a matching log row was updated. */
  applied: boolean;
  status?: EmailLogStatus;
}

/**
 * Apply one webhook event to `email_log`. Unrecognised event types (email.sent,
 * email.opened, email.clicked, …) are a deliberate no-op — we only track the
 * deliverability states §9.4/§11 care about.
 */
export async function applyEmailStatusEvent(
  client: AdminClient,
  event: ResendWebhookEvent,
): Promise<ApplyEventResult> {
  const status = EVENT_STATUS[event.type];
  if (!status || !event.data?.email_id) {
    return { applied: false };
  }
  const { updated } = await updateEmailLogStatus(client, event.data.email_id, status);
  return { applied: updated, status };
}
