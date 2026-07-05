/**
 * POST /api/webhooks/resend — Resend delivery-event webhook (PRD §9.4).
 * Verifies the Svix-style signature (when `RESEND_WEBHOOK_SECRET` is set),
 * then applies delivered/bounced/complained transitions to `email_log`.
 *
 * No signature secret configured (dev, before the webhook is registered with a
 * live domain — §17.5) → verification is skipped with a console warning rather
 * than hard-failing, so local testing works before that prerequisite lands.
 * Once `RESEND_WEBHOOK_SECRET` is set, an invalid/missing signature is a 401.
 */
import { apiHandler, AppError } from "@/lib/api/envelope";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyEmailStatusEvent, verifyWebhookSignature, type ResendWebhookEvent } from "@/lib/email";

export const POST = apiHandler(async (request) => {
  const rawBody = await request.text();
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  if (secret) {
    const id = request.headers.get("svix-id");
    const timestamp = request.headers.get("svix-timestamp");
    const signature = request.headers.get("svix-signature");
    const valid =
      id && timestamp && signature && verifyWebhookSignature(secret, { id, timestamp, signature }, rawBody);
    if (!valid) {
      throw new AppError("Invalid webhook signature.", "invalid_signature", 401);
    }
  } else {
    console.warn(
      "[webhooks/resend] RESEND_WEBHOOK_SECRET is not set — skipping signature verification. " +
        "Set it once the Resend domain + webhook are configured (§17.5).",
    );
  }

  let event: ResendWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    throw new AppError("Malformed webhook payload.", "invalid_payload", 400);
  }

  const result = await applyEmailStatusEvent(createAdminClient(), event);
  return { received: true, ...result };
});
