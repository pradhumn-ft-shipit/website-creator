/**
 * Round-1 structured intake (PRD §8.3) — the shape Gemini extracts from the
 * scrape + uploaded docs, and the shape `intake_data.structured_intake_json`
 * stores. Every field carries a `confidence` (0–1) and `sources` (where it came
 * from: a page URL or `uploaded:<filename>`), so the Round-1 confirm-or-correct
 * UI (013) can flag low-confidence guesses for the advisor to fix (§4.1 step 10).
 *
 * Parsing is deliberately LENIENT: extraction is best-effort, and "we couldn't
 * find it" is represented as `{ value: null, confidence: 0 }`, not a parse
 * failure. The GeminiClient repair loop only needs us to throw when the output
 * isn't even an object — beyond that we coerce each field into shape. The
 * jsonSchema we send steers Gemini toward the right structure up front.
 */

import type { OutputSchema } from "@/lib/gemini";

/** A single extracted field: the value (or null if not found) + provenance. */
export interface IntakeField<T> {
  value: T | null;
  /** 0 = absent/guessed, 1 = explicitly stated in a source. */
  confidence: number;
  /** Page URLs or `uploaded:<filename>` strings the value was drawn from. */
  sources: string[];
}

export interface IntakeLocation {
  city: string | null;
  state: string | null;
  zip: string | null;
}

/** §8.3 Round-1 fee-structure options. */
export type FeeStructure = "aum_percent" | "flat" | "hourly" | "hybrid";

export interface RoundOneIntake {
  firmName: IntakeField<string>;
  location: IntakeField<IntakeLocation>;
  yearFounded: IntakeField<number>;
  teamSize: IntakeField<number>;
  primaryServices: IntakeField<string[]>;
  idealClientPersona: IntakeField<string>;
  aumRange: IntakeField<string>;
  custodian: IntakeField<string>;
  feeStructure: IntakeField<FeeStructure>;
  designations: IntakeField<string[]>;
  crdNumber: IntakeField<string>;
  /** Hex colors extracted from the existing site (feeds 015 previews + voice). */
  brandColors: IntakeField<string[]>;
}

/** Field keys in a stable order, for iteration + the jsonSchema builder. */
export const ROUND_ONE_FIELDS: ReadonlyArray<keyof RoundOneIntake> = [
  "firmName",
  "location",
  "yearFounded",
  "teamSize",
  "primaryServices",
  "idealClientPersona",
  "aumRange",
  "custodian",
  "feeStructure",
  "designations",
  "crdNumber",
  "brandColors",
] as const;

function fieldJsonSchema(valueSchema: Record<string, unknown>) {
  return {
    type: "object",
    properties: {
      value: valueSchema,
      confidence: { type: "number", minimum: 0, maximum: 1 },
      sources: { type: "array", items: { type: "string" } },
    },
    required: ["value", "confidence", "sources"],
  };
}

const stringValue = { type: ["string", "null"] };
const numberValue = { type: ["number", "null"] };
const stringArrayValue = { type: "array", items: { type: "string" } };

/** JSON Schema sent to Gemini to steer the structured Round-1 output (§8.2.3). */
export const ROUND_ONE_JSON_SCHEMA = {
  type: "object",
  properties: {
    firmName: fieldJsonSchema(stringValue),
    location: fieldJsonSchema({
      type: ["object", "null"],
      properties: {
        city: stringValue,
        state: stringValue,
        zip: stringValue,
      },
    }),
    yearFounded: fieldJsonSchema(numberValue),
    teamSize: fieldJsonSchema(numberValue),
    primaryServices: fieldJsonSchema(stringArrayValue),
    idealClientPersona: fieldJsonSchema(stringValue),
    aumRange: fieldJsonSchema(stringValue),
    custodian: fieldJsonSchema(stringValue),
    feeStructure: fieldJsonSchema({
      type: ["string", "null"],
      enum: ["aum_percent", "flat", "hourly", "hybrid", null],
    }),
    designations: fieldJsonSchema(stringArrayValue),
    crdNumber: fieldJsonSchema(stringValue),
    brandColors: fieldJsonSchema(stringArrayValue),
  },
  required: [...ROUND_ONE_FIELDS],
} as const;

/** An empty/not-found field. */
function emptyField<T>(): IntakeField<T> {
  return { value: null, confidence: 0, sources: [] };
}

/** Coerce an arbitrary value into a well-formed IntakeField (lenient). */
function coerceField<T>(raw: unknown, coerceValue: (v: unknown) => T | null): IntakeField<T> {
  if (typeof raw !== "object" || raw === null) return emptyField<T>();
  const r = raw as { value?: unknown; confidence?: unknown; sources?: unknown };
  const confidence =
    typeof r.confidence === "number" && r.confidence >= 0 && r.confidence <= 1
      ? r.confidence
      : 0;
  const sources = Array.isArray(r.sources)
    ? r.sources.filter((s): s is string => typeof s === "string")
    : [];
  return { value: coerceValue(r.value), confidence, sources };
}

const asString = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v : null;
const asNumber = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const asStringArray = (v: unknown): string[] | null =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null;
const asFeeStructure = (v: unknown): FeeStructure | null =>
  v === "aum_percent" || v === "flat" || v === "hourly" || v === "hybrid" ? v : null;
const asLocation = (v: unknown): IntakeLocation | null => {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  return { city: asString(o.city), state: asString(o.state), zip: asString(o.zip) };
};

/**
 * The OutputSchema the GeminiClient validates against. `parse` throws only on a
 * non-object (so the repair loop re-prompts), otherwise coerces every field into
 * a clean RoundOneIntake — missing/garbled fields become empty (confidence 0).
 */
export const roundOneSchema: OutputSchema<RoundOneIntake> = {
  jsonSchema: ROUND_ONE_JSON_SCHEMA,
  parse(value: unknown): RoundOneIntake {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error("intake output must be a JSON object");
    }
    const o = value as Record<string, unknown>;
    return {
      firmName: coerceField(o.firmName, asString),
      location: coerceField(o.location, asLocation),
      yearFounded: coerceField(o.yearFounded, asNumber),
      teamSize: coerceField(o.teamSize, asNumber),
      primaryServices: coerceField(o.primaryServices, asStringArray),
      idealClientPersona: coerceField(o.idealClientPersona, asString),
      aumRange: coerceField(o.aumRange, asString),
      custodian: coerceField(o.custodian, asString),
      feeStructure: coerceField(o.feeStructure, asFeeStructure),
      designations: coerceField(o.designations, asStringArray),
      crdNumber: coerceField(o.crdNumber, asString),
      brandColors: coerceField(o.brandColors, asStringArray),
    };
  },
};
