import { join } from "node:path";
import { describe, it, expect } from "vitest";

import {
  PROMPT_VERSION,
  PROMPT_NAMES,
  loadPrompt,
  parsePromptFile,
  assemblePrompt,
} from "./loader";

// Resolved from the platform cwd (where `npm test` runs), not import.meta —
// vitest's transformed module URL is not a file:// URL under jsdom.
const FIXTURES_DIR = join(process.cwd(), "src/lib/prompts/__fixtures__");

describe("parsePromptFile (pure)", () => {
  it("splits YAML-ish frontmatter from the body", () => {
    const { frontmatter, body } = parsePromptFile(
      "---\nversion: v1\nmodel: pro\n---\nHello {{name}}.\n",
    );
    expect(frontmatter.version).toBe("v1");
    expect(frontmatter.model).toBe("pro");
    expect(body.trim()).toBe("Hello {{name}}.");
  });

  it("treats a file with no frontmatter as all body", () => {
    const { frontmatter, body } = parsePromptFile("Just a prompt, no meta.");
    expect(frontmatter).toEqual({});
    expect(body).toContain("Just a prompt");
  });
});

describe("assemblePrompt (pure slot substitution)", () => {
  const loaded = { ref: "x@v1", text: "Rules: {{compliance_ruleset}} / Voice: {{brand_voice}}" };

  it("fills every {{slot}} from vars", () => {
    const out = assemblePrompt(loaded, {
      compliance_ruleset: "no guarantees",
      brand_voice: "warm, plain",
    });
    expect(out).toBe("Rules: no guarantees / Voice: warm, plain");
    expect(out).not.toMatch(/\{\{/);
  });

  it("throws (fail-loud) when a required slot is left unfilled — e.g. caller forgets the ruleset", () => {
    expect(() => assemblePrompt(loaded, { brand_voice: "warm" })).toThrow(
      /compliance_ruleset/,
    );
  });

  it("throws on an unknown var that matches no slot (typo guard)", () => {
    expect(() =>
      assemblePrompt(loaded, {
        compliance_ruleset: "x",
        brand_voice: "y",
        complaince_ruleset: "typo",
      }),
    ).toThrow(/complaince_ruleset/);
  });
});

describe("loadPrompt (fs at the seam, dir injected)", () => {
  it("loads a versioned prompt and returns text + a persistable version ref", () => {
    const p = loadPrompt("sample", { dir: FIXTURES_DIR });
    expect(p.version).toBe(PROMPT_VERSION);
    expect(p.ref).toBe(`sample@${PROMPT_VERSION}`);
    expect(p.text).toContain("{{compliance_ruleset}}");
    expect(p.frontmatter.version).toBe("v1");
  });

  it("throws a clear error for a missing prompt file", () => {
    expect(() => loadPrompt("does-not-exist", { dir: FIXTURES_DIR })).toThrow(
      /does-not-exist/,
    );
  });

  it("exposes the canonical prompt-name set", () => {
    expect(PROMPT_NAMES).toContain("generate-site");
    expect(PROMPT_NAMES).toContain("layer2-validate");
  });
});
