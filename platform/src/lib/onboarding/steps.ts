/**
 * Onboarding step model (PRD §4.1 steps 4–6, §7.7) — the pure, client-safe core
 * of the onboarding shell. No IO: it answers "which step should the advisor see"
 * and "is this industry buildable yet" so both the server page (resume) and the
 * client flow (Back/Next, progress rail) derive their state from one source.
 *
 * Resume is derived from persisted `accounts` fields rather than a separate
 * progress table (decision 2026-06-05): industry/sub_industry land on the
 * account as they're answered, and an existing order is the authoritative
 * signal that the pipeline already started.
 */

/** The five §2.2 industry cards. Only RIA is buildable in v1; the rest waitlist. */
export const INDUSTRIES = [
  { key: "ria", label: "Financial Advisory (RIA)", live: true },
  { key: "insurance", label: "Insurance", live: false },
  { key: "mortgage", label: "Mortgage", live: false },
  { key: "law", label: "Law", live: false },
  { key: "real_estate", label: "Real Estate", live: false },
] as const;

export type IndustryKey = (typeof INDUSTRIES)[number]["key"];

/** The non-RIA industries — the ones that route to waitlist capture (011). */
export const WAITLIST_INDUSTRIES = INDUSTRIES.filter((i) => !i.live).map(
  (i) => i.key,
) as Exclude<IndustryKey, "ria">[];

/** v1 ships RIA-only (no BD-affiliated, no FINRA 2210 flow — out of scope). */
export const RIA_SUB_CLASS = "ria_only";

export function isLiveIndustry(key: string): boolean {
  return INDUSTRIES.some((i) => i.key === key && i.live);
}

/**
 * Sub-classification confirm (§4.1 step 5). SEC-vs-state is resolved later from
 * AUM (§5.5), so the only choice here is "RIA-only" — anything else is out of v1.
 */
export function validateSubClass(value: string): string | null {
  return value === RIA_SUB_CLASS
    ? null
    : "We currently support RIA-only firms.";
}

/** The three input steps, in order. `handoff` is the terminal post-order state. */
export const ONBOARDING_STEPS = ["industry", "subclass", "payment"] as const;

export type StepKey = (typeof ONBOARDING_STEPS)[number] | "handoff";

export type ResumeState = {
  industry: string | null;
  subIndustry: string | null;
  hasOrder: boolean;
};

/**
 * Where to drop the advisor back in. An existing order wins outright (the
 * pipeline is already running); otherwise walk forward through the answered
 * fields. Skipping a question is impossible because each step persists before
 * advancing.
 */
export function resolveResumeStep(state: ResumeState): StepKey {
  if (state.hasOrder) return "handoff";
  if (!state.industry) return "industry";
  if (!state.subIndustry) return "subclass";
  return "payment";
}

/** 1-based position of `step` for the progress rail. Handoff reads as complete. */
export function stepProgress(step: StepKey): { current: number; total: number } {
  const total = ONBOARDING_STEPS.length;
  if (step === "handoff") return { current: total, total };
  return { current: ONBOARDING_STEPS.indexOf(step) + 1, total };
}
