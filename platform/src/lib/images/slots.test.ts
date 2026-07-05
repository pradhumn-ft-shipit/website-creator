import { describe, expect, it } from "vitest";

import {
  SITE_IMAGE_SLOTS,
  planImageResolution,
  type SlotPlan,
} from "./slots";

const ids = () => SITE_IMAGE_SLOTS.map((s) => s.id);
const bySource = (plans: SlotPlan[], source: SlotPlan["source"]) =>
  plans.filter((p) => p.source === source);

describe("SITE_IMAGE_SLOTS", () => {
  it("is minimal-by-design and every slot carries a stock query + AI subject", () => {
    // §6.7: templates prefer typography/whitespace — the slot set stays small.
    expect(SITE_IMAGE_SLOTS.length).toBeGreaterThan(0);
    expect(SITE_IMAGE_SLOTS.length).toBeLessThanOrEqual(4);
    for (const slot of SITE_IMAGE_SLOTS) {
      expect(slot.id).toBeTruthy();
      expect(slot.stockQuery).toBeTruthy();
      // AI subject must be one of the allowed abstract/office/nature categories.
      expect(["abstract", "office", "nature"]).toContain(slot.aiSubject);
    }
  });
});

describe("planImageResolution — stock-first, AI-capped resolution order (§6.7)", () => {
  it("uses an advisor upload when one is mapped to the slot (advisor wins)", () => {
    const [first] = ids();
    const plans = planImageResolution({
      advisorFilled: new Set([first]),
      stockFilled: new Set(ids()), // stock also available, but advisor wins
      aiBudget: 3,
    });
    expect(plans.find((p) => p.slotId === first)?.source).toBe("advisor");
  });

  it("resolves a slot with stock BEFORE ever generating AI", () => {
    const plans = planImageResolution({
      advisorFilled: new Set(),
      stockFilled: new Set(ids()),
      aiBudget: 3,
    });
    expect(bySource(plans, "stock").length).toBe(SITE_IMAGE_SLOTS.length);
    // No AI generated when stock covers everything — the core requirement.
    expect(bySource(plans, "ai").length).toBe(0);
  });

  it("falls back to AI ONLY for slots stock could not fill", () => {
    const all = ids();
    const stockCovers = new Set([all[0]]);
    const plans = planImageResolution({
      advisorFilled: new Set(),
      stockFilled: stockCovers,
      aiBudget: 3,
    });
    expect(plans.find((p) => p.slotId === all[0])?.source).toBe("stock");
    // Every OTHER slot missed stock → AI (within budget).
    for (const id of all.slice(1)) {
      expect(plans.find((p) => p.slotId === id)?.source).toBe("ai");
    }
  });

  it("enforces the hard cap: never plans more AI images than the budget", () => {
    const plans = planImageResolution({
      advisorFilled: new Set(),
      stockFilled: new Set(), // nothing from stock → all slots want AI
      aiBudget: 2,
    });
    expect(bySource(plans, "ai").length).toBe(2);
    // Slots beyond the budget resolve to 'none' (template uses typography).
    expect(bySource(plans, "none").length).toBe(SITE_IMAGE_SLOTS.length - 2);
  });

  it("plans zero AI images when the budget is 0 (quota already spent)", () => {
    const plans = planImageResolution({
      advisorFilled: new Set(),
      stockFilled: new Set(),
      aiBudget: 0,
    });
    expect(bySource(plans, "ai").length).toBe(0);
    expect(bySource(plans, "none").length).toBe(SITE_IMAGE_SLOTS.length);
  });

  it("carries the AI subject + stock query onto each plan for downstream steps", () => {
    const plans = planImageResolution({
      advisorFilled: new Set(),
      stockFilled: new Set(),
      aiBudget: 10,
    });
    for (const plan of plans) {
      const slot = SITE_IMAGE_SLOTS.find((s) => s.id === plan.slotId)!;
      expect(plan.aiSubject).toBe(slot.aiSubject);
      expect(plan.stockQuery).toBe(slot.stockQuery);
    }
  });
});
