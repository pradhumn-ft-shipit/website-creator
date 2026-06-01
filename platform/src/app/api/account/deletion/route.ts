import { apiHandler } from "@/lib/api/envelope";
import {
  cancelAccountDeletion,
  requestAccountDeletion,
} from "@/lib/account/service";

/**
 * Account deletion grace window (PRD §12.9) — distinct from subscription
 * cancellation.
 *   POST   → schedule deletion, starting the 30-day grace window.
 *   DELETE → cancel a pending deletion (within the window).
 * Both are idempotent. The actual purge job is deferred (Inngest + cron).
 */
export const POST = apiHandler(async () => requestAccountDeletion());

export const DELETE = apiHandler(async () => cancelAccountDeletion());
