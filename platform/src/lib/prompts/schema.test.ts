import { describe, it, expect } from "vitest";

import {
  GENERATED_SITE_SCHEMA,
  SCHEMA_VERSION,
  type GeneratedField,
  type GeneratedSite,
} from "./schema";

/** A field factory so each test mutates one thing away from valid. */
function field(value = "Acme Wealth Partners", confidence = 0.9): GeneratedField {
  return { value, confidence, sources: ["intake:firm_name"] };
}

/** A fully-valid v1 site every test starts from, then mutates. */
function validSite(): GeneratedSite {
  return {
    schemaVersion: SCHEMA_VERSION,
    firm: {
      name: field(),
      tagline: field("Fee-only planning for families"),
      registration: field("SEC-registered investment adviser"),
    },
    pages: [
      {
        key: "home",
        title: field("Home"),
        sections: [
          { key: "hero", heading: field("Plan with clarity"), body: field("We help you...") },
        ],
      },
    ],
    footer: {
      disclaimer: field("Registration does not imply a certain level of skill or training."),
      privacyNotice: field("We respect your privacy."),
      links: [
        { label: "Form ADV Part 2A", url: "https://x/adv2a.pdf", kind: "adv_2a" },
        { label: "Form CRS", url: "https://x/crs.pdf", kind: "crs" },
        { label: "Privacy Policy", url: "/privacy", kind: "privacy" },
      ],
    },
  };
}

describe("GENERATED_SITE_SCHEMA", () => {
  it("exposes a versioned schema with a JSON Schema literal for Gemini steering", () => {
    expect(SCHEMA_VERSION).toBe("site.v1");
    expect(GENERATED_SITE_SCHEMA.jsonSchema).toBeTypeOf("object");
  });

  it("parses a fully-valid site and returns the typed value", () => {
    const site = validSite();
    const parsed = GENERATED_SITE_SCHEMA.parse(site);
    expect(parsed.firm.name.value).toBe("Acme Wealth Partners");
    expect(parsed.footer.links.find((l) => l.kind === "crs")?.url).toContain("crs");
  });

  it("rejects a wrong schemaVersion", () => {
    const site = { ...validSite(), schemaVersion: "site.v0" };
    expect(() => GENERATED_SITE_SCHEMA.parse(site)).toThrow(/schemaVersion/i);
  });

  it("rejects non-object input", () => {
    expect(() => GENERATED_SITE_SCHEMA.parse(null)).toThrow();
    expect(() => GENERATED_SITE_SCHEMA.parse("nope")).toThrow();
  });

  describe("per-field confidence + sources (§8.2.4)", () => {
    it("rejects a field missing confidence", () => {
      const site = validSite();
      delete (site.firm.name as Partial<GeneratedField>).confidence;
      expect(() => GENERATED_SITE_SCHEMA.parse(site)).toThrow(/confidence/i);
    });

    it("rejects confidence above 1 or below 0 or NaN", () => {
      for (const bad of [1.5, -0.1, Number.NaN]) {
        const site = validSite();
        site.firm.tagline.confidence = bad;
        expect(() => GENERATED_SITE_SCHEMA.parse(site)).toThrow(/confidence/i);
      }
    });

    it("rejects a field missing sources or with a non-array / non-string sources", () => {
      const noSources = validSite();
      delete (noSources.firm.name as Partial<GeneratedField>).sources;
      expect(() => GENERATED_SITE_SCHEMA.parse(noSources)).toThrow(/sources/i);

      const notArray = validSite();
      (notArray.firm.name as { sources: unknown }).sources = "intake";
      expect(() => GENERATED_SITE_SCHEMA.parse(notArray)).toThrow(/sources/i);

      const notStrings = validSite();
      (notArray.firm.name as { sources: unknown }).sources = [1, 2];
      (notStrings.firm.name as { sources: unknown }).sources = [1, 2];
      expect(() => GENERATED_SITE_SCHEMA.parse(notStrings)).toThrow(/sources/i);
    });

    it("allows an empty sources array (default/template content)", () => {
      const site = validSite();
      site.firm.tagline.sources = [];
      expect(() => GENERATED_SITE_SCHEMA.parse(site)).not.toThrow();
    });

    it("rejects a missing, empty, or non-string value", () => {
      const empty = validSite();
      empty.firm.name.value = "";
      expect(() => GENERATED_SITE_SCHEMA.parse(empty)).toThrow(/value/i);

      const missing = validSite();
      delete (missing.firm.name as Partial<GeneratedField>).value;
      expect(() => GENERATED_SITE_SCHEMA.parse(missing)).toThrow(/value/i);
    });

    it("walks nested page section fields, not just top-level firm fields", () => {
      const site = validSite();
      site.pages[0].sections[0].body.confidence = 9;
      expect(() => GENERATED_SITE_SCHEMA.parse(site)).toThrow(/confidence/i);
    });
  });

  describe("structure", () => {
    it("rejects empty or non-array pages", () => {
      const empty = { ...validSite(), pages: [] };
      expect(() => GENERATED_SITE_SCHEMA.parse(empty)).toThrow(/pages/i);
    });

    it("rejects a footer link with an invalid kind or missing url", () => {
      const badKind = validSite();
      (badKind.footer.links[0] as { kind: string }).kind = "twitter";
      expect(() => GENERATED_SITE_SCHEMA.parse(badKind)).toThrow(/kind/i);

      const noUrl = validSite();
      delete (noUrl.footer.links[1] as Partial<{ url: string }>).url;
      expect(() => GENERATED_SITE_SCHEMA.parse(noUrl)).toThrow(/url/i);
    });
  });
});
