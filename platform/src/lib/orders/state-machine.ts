/**
 * Order state machine — pure core (PRD §18.1, §13.1).
 *
 * Encodes the full ordered state list and the legal transition table for an
 * order's lifecycle from payment to live site. This module is IO-free: it holds
 * no DB access and no Inngest dependency, so transitions can be exhaustively
 * unit-tested. The IO layer (transitions.ts) consumes `assertTransition` and
 * persists the result.
 *
 * Layer-3 gating predicate (Q4c, §5.2/§13.3) also lives here as a pure function:
 * Layer 3 runs only when Layer 2 flags OR the site is within the first 50.
 */

/** Happy-path states, in pipeline order (positions 0..17). */
const HAPPY_PATH = [
  "payment_received",
  "scraping",
  "scrape_complete",
  "scrape_failed",
  "docs_upload_fallback",
  "onboarding_in_progress",
  "onboarding_complete",
  "generating_copy",
  "copy_review",
  "copy_approved",
  "compliance_review_layer2",
  "compliance_review_layer3",
  "building",
  "deploying",
  "deployed",
  "email_sent",
  "live",
  "dns_monitoring",
] as const;

/**
 * Appended failure states (terminal unless retried). `scrape_failed` is NOT
 * here — it lives in HAPPY_PATH because it's a recoverable branch with a legal
 * exit (→ docs_upload_fallback). `isFailureState` still classifies it as a
 * failure via FAILURE_STATE_SET below.
 */
const FAILURE_STATES = [
  "generation_failed",
  "validation_failed",
  "build_failed",
  "deploy_failed",
] as const;

/** All states `isFailureState` treats as failures, incl. the recoverable scrape_failed. */
const FAILURE_STATE_SET: ReadonlySet<string> = new Set<string>([
  "scrape_failed",
  ...FAILURE_STATES,
]);

/**
 * Full ordered state list. `scrape_failed` lives in HAPPY_PATH because it is a
 * recoverable branch with its own legal exit (→ docs_upload_fallback); the
 * other failure states are appended after.
 */
export const ORDERED_STATES = [...HAPPY_PATH, ...FAILURE_STATES] as const;

export type OrderState = (typeof ORDERED_STATES)[number];

/**
 * Legal transition table. Key = current state, value = states it may move to.
 * Any (from, to) pair not present here is illegal and rejected.
 */
const TRANSITIONS: Record<OrderState, readonly OrderState[]> = {
  payment_received: ["scraping"],
  scraping: ["scrape_complete", "scrape_failed"],
  scrape_complete: ["onboarding_in_progress"],
  scrape_failed: ["docs_upload_fallback"],
  docs_upload_fallback: ["onboarding_in_progress"],
  onboarding_in_progress: ["onboarding_complete"],
  onboarding_complete: ["generating_copy"],
  generating_copy: ["copy_review", "generation_failed"],
  copy_review: ["copy_approved"],
  copy_approved: ["compliance_review_layer2"],
  // §18.1: Layer 3 is conditional — skip straight to building when not required.
  compliance_review_layer2: [
    "compliance_review_layer3",
    "building",
    "validation_failed",
  ],
  compliance_review_layer3: ["building", "validation_failed"],
  building: ["deploying", "build_failed"],
  deploying: ["deployed", "deploy_failed"],
  deployed: ["email_sent", "deploy_failed"],
  email_sent: ["live"],
  live: ["dns_monitoring"],
  dns_monitoring: [],
  // Failure states are terminal in the core; recovery is a fresh run / manual.
  generation_failed: [],
  validation_failed: [],
  build_failed: [],
  deploy_failed: [],
};

export class IllegalTransitionError extends Error {
  readonly from: OrderState;
  readonly to: OrderState;

  constructor(from: OrderState, to: OrderState) {
    super(`Illegal order state transition: ${from} → ${to}`);
    this.name = "IllegalTransitionError";
    this.from = from;
    this.to = to;
  }
}

/** Numeric position of a state, persisted as `orders.state_machine_position`. */
export function positionOf(state: OrderState): number {
  return ORDERED_STATES.indexOf(state);
}

export function isFailureState(state: OrderState): boolean {
  return FAILURE_STATE_SET.has(state);
}

export function canTransition(from: OrderState, to: OrderState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Returns `to` if the transition is legal, otherwise throws
 * IllegalTransitionError. Callers in the IO layer use the return value as the
 * value to persist.
 */
export function assertTransition(
  from: OrderState,
  to: OrderState,
): OrderState {
  if (!canTransition(from, to)) {
    throw new IllegalTransitionError(from, to);
  }
  return to;
}

export type Layer2Verdict = "pass" | "warn" | "flag";

export interface Layer2Outcome {
  verdict: Layer2Verdict;
  /** Zero-based index of this site across all orders (for first-50 gate). */
  siteIndex: number;
}

/** Sites at or below this index always route to Layer 3 (§13.3). */
export const FIRST_N_SITES_MANUAL_GATE = 50;

/**
 * Q4c gating predicate (§5.2/§13.3): Layer 3 runs only if Layer 2 flagged OR
 * the site is within the first 50. A pass/warn beyond the first 50 skips it.
 */
export function layer3Required({ verdict, siteIndex }: Layer2Outcome): boolean {
  if (siteIndex < FIRST_N_SITES_MANUAL_GATE) return true;
  return verdict === "flag";
}

/**
 * Given the current state and the Layer-2 outcome, returns the next state on
 * the happy path: Layer 3 if required, else straight to building.
 */
export function nextStateAfter(
  from: Extract<OrderState, "compliance_review_layer2">,
  outcome: Layer2Outcome,
): OrderState {
  return layer3Required(outcome) ? "compliance_review_layer3" : "building";
}
