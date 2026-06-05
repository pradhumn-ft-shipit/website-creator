/**
 * Dev-gated Layer-2 compliance smoke check (PRD §5.2) — the ticket's verify
 * path. Validates a clean fixture (expect: pass, 0 violations) and a fixture
 * seeded with "guaranteed" + a missing CRS footer link (expect: fail, ≥2
 * violations) against the active RIA ruleset, and returns both verdicts via the
 * `{data,error}` envelope.
 *
 * Runs fully offline: the deterministic pass alone produces both verdicts, so no
 * Gemini key is required. When `GEMINI_API_KEY` is set, the AI semantic pass is
 * additionally run (additive — it can only add violations).
 *
 * Hard-disabled outside development (404) so it never runs in production.
 *
 *   GET /api/dev/compliance-check
 */

import { apiHandler, AppError } from "@/lib/api/envelope";
import { geminiClient } from "@/lib/gemini";

import { runLayer2, type Layer2Gemini, type ValidationSubject } from "@/lib/compliance";

/** A compliant RIA site fixture (CRS/ADV/privacy links + required disclaimers). */
function cleanSite(): Record<string, unknown> {
  return {
    schemaVersion: "site.v1",
    firm: {
      name: { value: "Cedar Ridge Wealth Advisors", confidence: 0.96, sources: ["intake:firm_name"] },
      tagline: { value: "Fee-only financial planning for families near retirement", confidence: 0.82, sources: [] },
      registration: { value: "Cedar Ridge Wealth Advisors is an SEC-registered investment adviser.", confidence: 0.95, sources: [] },
    },
    pages: [
      {
        key: "home",
        title: { value: "Home", confidence: 1, sources: [] },
        sections: [
          { key: "hero", heading: { value: "Plan with clarity, invest with discipline", confidence: 0.7, sources: [] }, body: { value: "We help families approaching retirement build a plan they understand.", confidence: 0.68, sources: [] } },
        ],
      },
    ],
    footer: {
      disclaimer: { value: "Registration does not imply a certain level of skill or training. Information on this website is for informational purposes only and does not constitute investment, tax, or legal advice.", confidence: 0.99, sources: [] },
      privacyNotice: { value: "We protect your nonpublic personal information in accordance with our Privacy Policy and Regulation S-P.", confidence: 0.9, sources: [] },
      links: [
        { label: "Form ADV Part 2A", url: "https://reports.adviserinfo.sec.gov/adv-2a.pdf", kind: "adv_2a" },
        { label: "Form ADV Part 2B", url: "https://reports.adviserinfo.sec.gov/adv-2b.pdf", kind: "adv_2b" },
        { label: "Form CRS", url: "https://reports.adviserinfo.sec.gov/crs.pdf", kind: "crs" },
        { label: "Privacy Policy", url: "/privacy", kind: "privacy" },
      ],
    },
  };
}

/** The clean site mutated to be non-compliant: a guaranteed-returns claim + no CRS link. */
function badSite(): Record<string, unknown> {
  const site = cleanSite();
  const home = (site.pages as Array<Record<string, unknown>>)[0];
  const hero = (home.sections as Array<Record<string, unknown>>)[0];
  (hero.body as Record<string, unknown>).value =
    "Our strategy is guaranteed to outperform the market with no risk to your principal.";
  const footer = site.footer as Record<string, unknown>;
  footer.links = (footer.links as Array<Record<string, unknown>>).filter((l) => l.kind !== "crs");
  return site;
}

export const GET = apiHandler(async () => {
  if (process.env.NODE_ENV === "production") {
    throw new AppError("Not found.", "not_found", 404);
  }

  // Use the real Flash pass only when a key is configured; otherwise the
  // deterministic pass alone produces the verdicts (offline-verifiable).
  const gemini: Layer2Gemini | undefined = process.env.GEMINI_API_KEY ? geminiClient() : undefined;

  const cleanSubject: ValidationSubject = { kind: "site", site: cleanSite() };
  const badSubject: ValidationSubject = { kind: "site", site: badSite() };

  const clean = await runLayer2({ subject: cleanSubject, registration: "sec", gemini });
  const bad = await runLayer2({ subject: badSubject, registration: "sec", gemini });

  return {
    rulesetVersion: clean.rulesetVersion,
    aiPassRan: clean.aiPassRan,
    clean: { verdict: clean.verdict, violationCount: clean.violations.length },
    bad: {
      verdict: bad.verdict,
      violationCount: bad.violations.length,
      violations: bad.violations.map((v) => ({ ruleId: v.ruleId, severity: v.severity, fieldPath: v.fieldPath, source: v.source })),
    },
  };
});
