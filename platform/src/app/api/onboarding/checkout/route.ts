import { apiHandler } from "@/lib/api/envelope";
import {
  createOrderAndEnqueue,
  resolveOnboardingDeps,
} from "@/lib/onboarding/service";

/**
 * POST /api/onboarding/checkout — simulated alpha checkout (§15.4).
 * Payment is a placeholder in alpha, so "success" lands here directly: create
 * the advisor's order at the pipeline entry state and emit `order.created` (009
 * picks it up). Idempotent — a double-submit returns the existing order without
 * starting a second build. Full Stripe enforcement is ticket 032.
 */
export const POST = apiHandler(async () => {
  return createOrderAndEnqueue(await resolveOnboardingDeps());
});
