import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ACTIVE_RIA_INDUSTRY,
  ACTIVE_RIA_VERSION,
  loadAndResolveRuleset,
  loadRuleset,
} from "./loader";

/** The real authored ruleset tree lives at <repo>/compliance, one level up from platform/. */
const COMPLIANCE_DIR = join(process.cwd(), "..", "compliance");

describe("loadRuleset (against the real ria/v1.0 artifacts)", () => {
  it("reads + parses rules.json, rules.md, the footer template, and the state overlays", () => {
    const loaded = loadRuleset({
      industry: "ria",
      version: "1.0",
      dir: COMPLIANCE_DIR,
    });

    expect(loaded.industry).toBe("ria");
    expect(loaded.version).toBe("1.0");
    // rules.json parsed through the typed parser.
    expect(loaded.rules.prohibitedTerms.length).toBeGreaterThan(0);
    expect(loaded.rules.requiredElements.some((e) => e.linkKind === "crs")).toBe(true);
    // human-readable markdown captured for the DB mirror.
    expect(loaded.rulesMarkdown.length).toBeGreaterThan(0);
    // footer template carries the standard placeholders.
    expect(loaded.footerTemplate).toMatch(/\{\{firm_name\}\}/);
    // top-10 state overlays loaded by code.
    expect(Object.keys(loaded.overlays)).toEqual(
      expect.arrayContaining(["CA", "NY", "TX", "FL"]),
    );
    expect(loaded.overlays.CA).toMatch(/California/);
  });

  it("throws naming the missing artifact when a version does not exist", () => {
    expect(() =>
      loadRuleset({ industry: "ria", version: "9.9", dir: COMPLIANCE_DIR }),
    ).toThrow(/9\.9/);
  });
});

describe("loadAndResolveRuleset", () => {
  it("resolves the active RIA ruleset for an SEC-registered adviser (no overlay)", () => {
    const resolved = loadAndResolveRuleset({
      registration: "sec",
      primaryState: "CA",
      dir: COMPLIANCE_DIR,
    });
    expect(resolved.versionString).toBe("ria/v1.0");
    expect(resolved.overlay).toBeNull();
    expect(resolved.promptText).toMatch(/SEC-registered/);
  });

  it("applies the state overlay for a state-registered adviser", () => {
    const resolved = loadAndResolveRuleset({
      registration: "state",
      primaryState: "CA",
      dir: COMPLIANCE_DIR,
    });
    expect(resolved.overlay?.state).toBe("CA");
    expect(resolved.promptText).toMatch(/California/);
  });

  it("defaults to the active RIA industry + version", () => {
    expect(ACTIVE_RIA_INDUSTRY).toBe("ria");
    expect(ACTIVE_RIA_VERSION).toBe("1.0");
    const resolved = loadAndResolveRuleset({ registration: "sec", dir: COMPLIANCE_DIR });
    expect(resolved.industry).toBe("ria");
    expect(resolved.version).toBe("1.0");
  });
});
