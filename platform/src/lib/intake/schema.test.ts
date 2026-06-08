import { describe, expect, it } from "vitest";

import {
  ROUND_ONE_FIELDS,
  ROUND_ONE_JSON_SCHEMA,
  roundOneSchema,
} from "./schema";

describe("roundOneSchema (§8.3 Round-1 extraction)", () => {
  it("parses a full, well-formed extraction", () => {
    const parsed = roundOneSchema.parse({
      firmName: { value: "Acme Advisors", confidence: 0.95, sources: ["https://acme.com/about"] },
      location: {
        value: { city: "Austin", state: "TX", zip: "78701" },
        confidence: 0.9,
        sources: ["https://acme.com/contact"],
      },
      yearFounded: { value: 2009, confidence: 0.8, sources: [] },
      teamSize: { value: 4, confidence: 0.6, sources: [] },
      primaryServices: { value: ["Financial planning", "Investment management"], confidence: 0.9, sources: [] },
      idealClientPersona: { value: "Pre-retirees", confidence: 0.7, sources: [] },
      aumRange: { value: "$50M-$100M", confidence: 0.5, sources: [] },
      custodian: { value: "Schwab", confidence: 0.8, sources: [] },
      feeStructure: { value: "aum_percent", confidence: 0.85, sources: [] },
      designations: { value: ["CFP", "CFA"], confidence: 0.9, sources: [] },
      crdNumber: { value: "1234567", confidence: 0.6, sources: ["uploaded:adv.pdf"] },
      brandColors: { value: ["#0A2540", "#FFFFFF"], confidence: 0.7, sources: [] },
    });

    expect(parsed.firmName.value).toBe("Acme Advisors");
    expect(parsed.location.value).toEqual({ city: "Austin", state: "TX", zip: "78701" });
    expect(parsed.feeStructure.value).toBe("aum_percent");
    expect(parsed.crdNumber.sources).toEqual(["uploaded:adv.pdf"]);
  });

  it("throws on a non-object so the repair loop re-prompts", () => {
    expect(() => roundOneSchema.parse("not json")).toThrow();
    expect(() => roundOneSchema.parse([1, 2, 3])).toThrow();
    expect(() => roundOneSchema.parse(null)).toThrow();
  });

  it("defaults missing fields to not-found (confidence 0), never throws", () => {
    const parsed = roundOneSchema.parse({ firmName: { value: "Solo RIA", confidence: 1, sources: [] } });
    expect(parsed.firmName.value).toBe("Solo RIA");
    for (const key of ROUND_ONE_FIELDS) {
      if (key === "firmName") continue;
      expect(parsed[key]).toEqual({ value: null, confidence: 0, sources: [] });
    }
  });

  it("clamps a bad confidence and drops non-string sources", () => {
    const parsed = roundOneSchema.parse({
      firmName: { value: "X", confidence: 5, sources: ["ok", 42, null] },
    });
    expect(parsed.firmName.confidence).toBe(0); // out of [0,1] → 0
    expect(parsed.firmName.sources).toEqual(["ok"]);
  });

  it("rejects an unknown fee structure (coerced to null)", () => {
    const parsed = roundOneSchema.parse({
      feeStructure: { value: "wrap_fee", confidence: 0.9, sources: [] },
    });
    expect(parsed.feeStructure.value).toBeNull();
  });

  it("drops empty-string values to null and filters non-string arrays", () => {
    const parsed = roundOneSchema.parse({
      firmName: { value: "  ", confidence: 0.5, sources: [] },
      designations: { value: ["CFP", 7, "CFA"], confidence: 0.5, sources: [] },
    });
    expect(parsed.firmName.value).toBeNull();
    expect(parsed.designations.value).toEqual(["CFP", "CFA"]);
  });

  it("exposes a jsonSchema requiring all Round-1 fields", () => {
    expect(ROUND_ONE_JSON_SCHEMA.required).toEqual([...ROUND_ONE_FIELDS]);
  });
});
