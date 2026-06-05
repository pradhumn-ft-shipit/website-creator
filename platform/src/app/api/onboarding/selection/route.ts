import { apiHandler } from "@/lib/api/envelope";
import { asString, readJson } from "@/lib/api/request";
import {
  resolveOnboardingDeps,
  saveOnboardingSelection,
  type SelectionPatch,
} from "@/lib/onboarding/service";

/**
 * POST /api/onboarding/selection — { industry?, subIndustry? }.
 * Auto-saves an onboarding answer to the advisor's account (§7.7). Either field
 * may be sent independently (industry step, then sub-class confirm); validation
 * lives in the service so an out-of-scope value never persists.
 */
export const POST = apiHandler(async (request) => {
  const body = await readJson(request);
  const patch: SelectionPatch = {};
  if (typeof body.industry === "string") patch.industry = asString(body.industry);
  if (typeof body.subIndustry === "string")
    patch.subIndustry = asString(body.subIndustry);

  return saveOnboardingSelection(await resolveOnboardingDeps(), patch);
});
