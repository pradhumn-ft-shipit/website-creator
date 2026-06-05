import {
  getOnboardingState,
  resolveOnboardingDeps,
} from "@/lib/onboarding/service";
import { resolveResumeStep } from "@/lib/onboarding/steps";
import { OnboardingFlow } from "@/components/onboarding/flow";

/**
 * Onboarding entry (§4.1 steps 4–6). Middleware guards the segment; here we read
 * the advisor's persisted onboarding state and resolve which step to resume at,
 * so a refresh or "continue later" return lands exactly where they left off.
 */
export default async function OnboardingPage() {
  const deps = await resolveOnboardingDeps();
  const state = await getOnboardingState(deps);
  const step = resolveResumeStep({
    industry: state.industry,
    subIndustry: state.subIndustry,
    hasOrder: state.hasOrder,
  });

  return <OnboardingFlow initialStep={step} initialOrderId={state.orderId} />;
}
