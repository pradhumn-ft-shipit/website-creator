/**
 * Versioned generation output schema (PRD §8.2.3, §8.2.4) — the JSON contract
 * every full-site generation call (020) targets and every eval (007) asserts
 * against. Two things live here and nowhere else:
 *
 *   1. The *shape* of a generated site (pages, sections, footer disclosures).
 *   2. The §8.2.4 invariant: **every generated content field carries a
 *      `confidence` (0–1) and a `sources[]`** — so low-confidence fields can be
 *      routed to human review and every claim is traceable to its origin.
 *
 * It is an `OutputSchema<GeneratedSite>` (the 008 bring-your-own contract):
 * `jsonSchema` steers Gemini's structured output; `parse` is the authoritative
 * gate that throws on any mismatch. `parse` validates *structure + the
 * confidence/sources invariant only* — it deliberately does NOT check content
 * properties like "no prohibited terms" or "CRS link present"; those are the
 * eval property-checks (runner.ts) and Layer-2's job, not the schema's.
 */

import type { OutputSchema } from "@/lib/gemini";

/** Bump when the site shape changes; persisted on generated_content rows. */
export const SCHEMA_VERSION = "site.v1";

/** A single generated content field: the value plus its provenance (§8.2.4). */
export interface GeneratedField<T = string> {
  value: T;
  /** Model self-rated confidence, 0–1. Below threshold → human review. */
  confidence: number;
  /** Where the value came from (e.g. "intake:firm_name", "scrape:about"). May be empty for default/template copy. */
  sources: string[];
}

export interface GeneratedSection {
  key: string;
  heading: GeneratedField;
  body: GeneratedField;
}

export interface GeneratedPage {
  key: string;
  title: GeneratedField;
  sections: GeneratedSection[];
}

export type FooterLinkKind = "adv_2a" | "adv_2b" | "crs" | "privacy" | "other";

export interface FooterLink {
  label: string;
  url: string;
  kind: FooterLinkKind;
}

export interface GeneratedSite {
  schemaVersion: string;
  firm: {
    name: GeneratedField;
    tagline: GeneratedField;
    registration: GeneratedField;
  };
  pages: GeneratedPage[];
  footer: {
    disclaimer: GeneratedField;
    privacyNotice: GeneratedField;
    links: FooterLink[];
  };
}

const FOOTER_LINK_KINDS: readonly FooterLinkKind[] = [
  "adv_2a",
  "adv_2b",
  "crs",
  "privacy",
  "other",
];

// ---- validation (pure, path-qualified messages so repair prompts are useful) ----

function fail(path: string, msg: string): never {
  throw new Error(`${path}: ${msg}`);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validateField(value: unknown, path: string): GeneratedField {
  if (!isObject(value)) fail(path, "must be an object {value, confidence, sources}");
  if (typeof value.value !== "string" || value.value.trim() === "") {
    fail(`${path}.value`, "must be a non-empty string");
  }
  if (
    typeof value.confidence !== "number" ||
    !Number.isFinite(value.confidence) ||
    value.confidence < 0 ||
    value.confidence > 1
  ) {
    fail(`${path}.confidence`, "must be a number between 0 and 1");
  }
  if (!Array.isArray(value.sources) || value.sources.some((s) => typeof s !== "string")) {
    fail(`${path}.sources`, "must be an array of strings");
  }
  return value as unknown as GeneratedField;
}

function validateSection(value: unknown, path: string): GeneratedSection {
  if (!isObject(value)) fail(path, "must be an object");
  if (typeof value.key !== "string" || value.key === "") fail(`${path}.key`, "must be a non-empty string");
  validateField(value.heading, `${path}.heading`);
  validateField(value.body, `${path}.body`);
  return value as unknown as GeneratedSection;
}

function validatePage(value: unknown, path: string): GeneratedPage {
  if (!isObject(value)) fail(path, "must be an object");
  if (typeof value.key !== "string" || value.key === "") fail(`${path}.key`, "must be a non-empty string");
  validateField(value.title, `${path}.title`);
  if (!Array.isArray(value.sections)) fail(`${path}.sections`, "must be an array");
  value.sections.forEach((s, i) => validateSection(s, `${path}.sections[${i}]`));
  return value as unknown as GeneratedPage;
}

function validateLink(value: unknown, path: string): FooterLink {
  if (!isObject(value)) fail(path, "must be an object");
  if (typeof value.label !== "string" || value.label === "") fail(`${path}.label`, "must be a non-empty string");
  if (typeof value.url !== "string" || value.url === "") fail(`${path}.url`, "must be a non-empty string");
  if (!FOOTER_LINK_KINDS.includes(value.kind as FooterLinkKind)) {
    fail(`${path}.kind`, `must be one of ${FOOTER_LINK_KINDS.join(", ")}`);
  }
  return value as unknown as FooterLink;
}

function parseSite(value: unknown): GeneratedSite {
  if (!isObject(value)) fail("site", "must be an object");
  if (value.schemaVersion !== SCHEMA_VERSION) {
    fail("site.schemaVersion", `must be "${SCHEMA_VERSION}"`);
  }

  if (!isObject(value.firm)) fail("site.firm", "must be an object");
  validateField(value.firm.name, "site.firm.name");
  validateField(value.firm.tagline, "site.firm.tagline");
  validateField(value.firm.registration, "site.firm.registration");

  if (!Array.isArray(value.pages) || value.pages.length === 0) {
    fail("site.pages", "must be a non-empty array");
  }
  value.pages.forEach((p, i) => validatePage(p, `site.pages[${i}]`));

  if (!isObject(value.footer)) fail("site.footer", "must be an object");
  validateField(value.footer.disclaimer, "site.footer.disclaimer");
  validateField(value.footer.privacyNotice, "site.footer.privacyNotice");
  if (!Array.isArray(value.footer.links)) fail("site.footer.links", "must be an array");
  value.footer.links.forEach((l, i) => validateLink(l, `site.footer.links[${i}]`));

  return value as unknown as GeneratedSite;
}

// ---- JSON Schema literal (steers Gemini structured output; §8.2.3) ----

const FIELD_JSON_SCHEMA = {
  type: "object",
  required: ["value", "confidence", "sources"],
  properties: {
    value: { type: "string", minLength: 1 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    sources: { type: "array", items: { type: "string" } },
  },
} as const;

const SITE_JSON_SCHEMA = {
  type: "object",
  required: ["schemaVersion", "firm", "pages", "footer"],
  properties: {
    schemaVersion: { type: "string", const: SCHEMA_VERSION },
    firm: {
      type: "object",
      required: ["name", "tagline", "registration"],
      properties: {
        name: FIELD_JSON_SCHEMA,
        tagline: FIELD_JSON_SCHEMA,
        registration: FIELD_JSON_SCHEMA,
      },
    },
    pages: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["key", "title", "sections"],
        properties: {
          key: { type: "string" },
          title: FIELD_JSON_SCHEMA,
          sections: {
            type: "array",
            items: {
              type: "object",
              required: ["key", "heading", "body"],
              properties: {
                key: { type: "string" },
                heading: FIELD_JSON_SCHEMA,
                body: FIELD_JSON_SCHEMA,
              },
            },
          },
        },
      },
    },
    footer: {
      type: "object",
      required: ["disclaimer", "privacyNotice", "links"],
      properties: {
        disclaimer: FIELD_JSON_SCHEMA,
        privacyNotice: FIELD_JSON_SCHEMA,
        links: {
          type: "array",
          items: {
            type: "object",
            required: ["label", "url", "kind"],
            properties: {
              label: { type: "string" },
              url: { type: "string" },
              kind: { type: "string", enum: FOOTER_LINK_KINDS },
            },
          },
        },
      },
    },
  },
} as const;

/** The site-generation output contract. Import this into 020 and the evals. */
export const GENERATED_SITE_SCHEMA: OutputSchema<GeneratedSite> = {
  jsonSchema: SITE_JSON_SCHEMA,
  parse: parseSite,
};
