/**
 * Site image slots + the pure resolution planner (PRD §6.7).
 *
 * A generated site has a small, fixed set of image slots — minimal by design,
 * because the templates prefer typography and whitespace over imagery. For each
 * slot the pipeline resolves an image source in a strict priority order:
 *
 *   1. advisor upload  — a real photo the advisor supplied (logo/team/office).
 *   2. stock           — Unsplash/Pexels, commercial-use, no attribution (§6.7).
 *   3. AI (capped)     — Gemini Flash Image, abstract/office/nature only, and
 *                        ONLY when stock found nothing, hard-capped per site.
 *   4. none            — leave the slot empty; the template falls back to type.
 *
 * This module owns the ORDER and the CAP as pure logic (no IO), so both are
 * unit-tested independently of the live stock/AI/storage boundaries.
 */

/** The abstract subject categories AI may render — never people (§6.7). */
export type AiSubject = "abstract" | "office" | "nature";

export interface ImageSlot {
  id: string;
  /** Human description of what the slot is for. */
  purpose: string;
  /** Search query used against the stock providers. */
  stockQuery: string;
  /** Which safe AI category to render if stock misses. */
  aiSubject: AiSubject;
}

/**
 * The v1 slot set. Deliberately tiny (§6.7 "minimal by design"): a hero backdrop
 * and one section accent. Advisor logo/team/office photos are separate advisor
 * uploads (§6.8), not slots resolved here.
 */
export const SITE_IMAGE_SLOTS: readonly ImageSlot[] = [
  {
    id: "hero_background",
    purpose: "Hero section background / accent",
    stockQuery: "abstract professional office architecture calm",
    aiSubject: "abstract",
  },
  {
    id: "about_accent",
    purpose: "About / firm-story section accent image",
    stockQuery: "modern office interior workspace no people",
    aiSubject: "office",
  },
  {
    id: "cta_background",
    purpose: "Closing call-to-action section backdrop",
    stockQuery: "calm nature landscape horizon minimal",
    aiSubject: "nature",
  },
] as const;

export type SlotSource = "advisor" | "stock" | "ai" | "none";

export interface SlotPlan {
  slotId: string;
  source: SlotSource;
  aiSubject: AiSubject;
  stockQuery: string;
}

export interface PlanInput {
  /** Slot ids already covered by an advisor upload. */
  advisorFilled: ReadonlySet<string>;
  /** Slot ids for which a usable stock image was found. */
  stockFilled: ReadonlySet<string>;
  /** Remaining AI-image budget for this site (≤ MAX_IMAGES_PER_SITE). */
  aiBudget: number;
}

/**
 * Decide each slot's source in the §6.7 priority order, enforcing the AI cap.
 * Pure: takes availability sets + the remaining AI budget, returns a plan per
 * slot. AI is chosen only for slots that missed both advisor and stock, and only
 * while budget remains — the rest fall to `none`.
 */
export function planImageResolution(input: PlanInput): SlotPlan[] {
  let aiRemaining = Math.max(0, Math.floor(input.aiBudget));
  return SITE_IMAGE_SLOTS.map((slot) => {
    let source: SlotSource;
    if (input.advisorFilled.has(slot.id)) {
      source = "advisor";
    } else if (input.stockFilled.has(slot.id)) {
      source = "stock";
    } else if (aiRemaining > 0) {
      source = "ai";
      aiRemaining -= 1;
    } else {
      source = "none";
    }
    return {
      slotId: slot.id,
      source,
      aiSubject: slot.aiSubject,
      stockQuery: slot.stockQuery,
    };
  });
}
