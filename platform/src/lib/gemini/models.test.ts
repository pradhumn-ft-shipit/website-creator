import { describe, expect, it } from "vitest";

import { GEMINI_MODELS, PRICING, resolveModel } from "./models";

describe("resolveModel (§8.1 routing)", () => {
  it("routes generation to Pro without search", () => {
    expect(resolveModel("generation")).toEqual({
      useCase: "generation",
      model: GEMINI_MODELS.pro,
      useSearch: false,
    });
  });

  it("routes Layer-2 validation and edit chat to Flash", () => {
    expect(resolveModel("validation").model).toBe(GEMINI_MODELS.flash);
    expect(resolveModel("edit").model).toBe(GEMINI_MODELS.flash);
  });

  it("routes intake extraction to Flash without search (comprehension, cheap)", () => {
    const r = resolveModel("intake");
    expect(r.model).toBe(GEMINI_MODELS.flash);
    expect(r.useSearch).toBe(false);
  });

  it("routes image generation to Flash Image", () => {
    expect(resolveModel("image").model).toBe(GEMINI_MODELS.flashImage);
  });

  it("routes the research agent to Pro WITH web search", () => {
    const r = resolveModel("research");
    expect(r.model).toBe(GEMINI_MODELS.pro);
    expect(r.useSearch).toBe(true);
  });
});

describe("PRICING", () => {
  it("has pricing for every routed model", () => {
    for (const model of Object.values(GEMINI_MODELS)) {
      expect(PRICING[model]).toBeDefined();
      expect(PRICING[model].inputPerMillion).toBeGreaterThan(0);
      expect(PRICING[model].outputPerMillion).toBeGreaterThan(0);
    }
  });

  it("prices Pro output higher than Flash output (quality model costs more)", () => {
    expect(PRICING[GEMINI_MODELS.pro].outputPerMillion).toBeGreaterThan(
      PRICING[GEMINI_MODELS.flash].outputPerMillion,
    );
  });
});
