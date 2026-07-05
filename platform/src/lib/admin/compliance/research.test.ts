import { describe, expect, it, vi } from "vitest";

import {
  buildResearchPrompt,
  parseResearchProposal,
  runResearchAgent,
  type ResearchGemini,
} from "./research";

const CITED_CHANGE = {
  category: "prohibitedContent",
  action: "add",
  summary: "Flag hypothetical/backtested performance without disclosures.",
  citations: [
    { title: "Marketing Rule 206(4)-1", url: "https://www.sec.gov/marketing", source: "SEC.gov", quote: "Hypothetical performance..." },
  ],
};

describe("parseResearchProposal", () => {
  it("accepts a proposal where every change is cited", () => {
    const p = parseResearchProposal({
      industry: "ria",
      baseVersion: "1.0",
      summary: "One change found.",
      changes: [CITED_CHANGE],
      sources: [{ title: "SEC marketing rule", url: "https://www.sec.gov/marketing" }],
    });
    expect(p.changes).toHaveLength(1);
    expect(p.changes[0].citations[0].url).toContain("sec.gov");
  });

  it("accepts an empty-changes proposal (nothing changed)", () => {
    const p = parseResearchProposal({ summary: "No material change.", changes: [] });
    expect(p.changes).toHaveLength(0);
  });

  it("REJECTS a change with no citation (the moat)", () => {
    expect(() =>
      parseResearchProposal({ summary: "x", changes: [{ ...CITED_CHANGE, citations: [] }] }),
    ).toThrow(/cite at least one regulator source/);
  });

  it("rejects a citation with a non-URL", () => {
    expect(() =>
      parseResearchProposal({
        summary: "x",
        changes: [{ ...CITED_CHANGE, citations: [{ title: "t", url: "not-a-url", source: "SEC" }] }],
      }),
    ).toThrow(/http/);
  });

  it("rejects an invalid action", () => {
    expect(() =>
      parseResearchProposal({ summary: "x", changes: [{ ...CITED_CHANGE, action: "delete" }] }),
    ).toThrow(/add\|modify\|remove/);
  });
});

describe("buildResearchPrompt", () => {
  it("names the regulator sources and the citation requirement", () => {
    const prompt = buildResearchPrompt({ industry: "ria", baseVersion: "1.0", rulesMarkdown: "# rules", lastReviewed: "2026-06-01" });
    expect(prompt).toContain("SEC.gov");
    expect(prompt).toContain("FINRA");
    expect(prompt).toMatch(/cite at least one/i);
    expect(prompt).toContain("v1.0");
  });
});

describe("runResearchAgent", () => {
  it("routes to the research use case and returns the cited proposal (no side effects)", async () => {
    const generateJSON = vi.fn().mockResolvedValue({
      data: parseResearchProposal({ summary: "found", changes: [CITED_CHANGE] }),
      costUsd: 0.03,
      model: "gemini-2.5-pro",
    });
    const gemini = { generateJSON } as unknown as ResearchGemini;

    const result = await runResearchAgent(gemini, { industry: "ria", baseVersion: "1.0", rulesMarkdown: "# rules", lastReviewed: null });

    expect(generateJSON).toHaveBeenCalledWith(
      expect.objectContaining({ useCase: "research", operation: "compliance_research" }),
    );
    expect(result.proposal.industry).toBe("ria");
    expect(result.proposal.changes).toHaveLength(1);
    expect(result.costUsd).toBe(0.03);
  });
});
