import { apiHandler } from "@/lib/api/envelope";
import { createOrder, resolveOnboardingDeps } from "@/lib/onboarding/service";

/**
 * POST /api/onboarding/checkout — simulated alpha checkout (§15.4).
 * Payment is a placeholder in alpha, so "success" lands here directly: create
 * the advisor's order at the pipeline entry state. Idempotent — a double-submit
 * returns the existing order. Per the 013 flow, the pipeline is NOT started
 * here; the intake screens run next and "Build my site" (after template
 * selection) emits `order.created`. Full Stripe enforcement is ticket 032.
 */
export const POST = apiHandler(async () => {
  return createOrder(await resolveOnboardingDeps());
});
