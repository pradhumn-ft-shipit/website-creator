/**
 * Compliance research agent (PRD §5.7, §11.2).
 *
 * Triggers Gemini 2.5 Pro + Google Search (routing already wired in 008 for the
 * `research` use case) to scan regulator sources — SEC.gov, FINRA notices, state
 * securities boards — for changes since the last published ruleset version, and
 * returns a STRUCTURED, CITED diff proposal. It is advisory only: the output is
 * a proposal a human turns into a draft and reviews. It NEVER writes a ruleset,
 * never touches `compliance_rulesets`, and cannot publish.
 *
 * Every proposed change must carry at least one citation (a regulator source
 * URL); the schema `parse` rejects any uncited change, so an un-sourced claim
 * can't survive into a proposal.
 *
 * Pure core: prompt building + the output schema (+ citation enforcement). IO:
 * `runResearchAgent` calls the injected Gemini client — mocked in tests, real in
 * the API route / weekly cron.
 */

import type { GenerateJSONResult, OutputSchema } from "@/lib/gemini/client";
import type { GeminiUseCase } from "@/lib/gemini/models";
import type { GeminiOperation } from "@/lib/gemini/budgets";

export type ProposalAction = "add" | "modify" | "remove";

export interface ResearchCitation {
  title: string;
  url: string;
  /** e.g. "SEC.gov", "FINRA", "state:CA". */
  source: string;
  /** The specific passage that supports the change. */
  quote: string;
}

export interface ProposedChange {
  category: string;
  action: ProposalAction;
  /** The rule id this concerns, if it maps to an existing rule. */
  ruleId?: string;
  summary: string;
  /** Suggested new/changed rule text (advisory). */
  proposedText?: string;
  citations: ResearchCitation[];
}

export interface ResearchProposal {
  industry: string;
  baseVersion: string;
  generatedAt: string;
  /** One-paragraph human summary of what the scan found. */
  summary: string;
  /** Empty when the scan found no regulatory change since the base version. */
  changes: ProposedChange[];
  /** All distinct sources consulted. */
  sources: { title: string; url: string }[];
}

// ---- schema (pure, with citation enforcement) ----------------------------

const ACTIONS: ReadonlySet<string> = new Set(["add", "modify", "remove"]);

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function reqStr(v: unknown, path: string): string {
  if (typeof v !== "string" || v.trim() === "") throw new Error(`${path} must be a non-empty string`);
  return v;
}

function parseCitation(raw: unknown, path: string): ResearchCitation {
  if (!isObj(raw)) throw new Error(`${path} must be an object`);
  const url = reqStr(raw.url, `${path}.url`);
  if (!/^https?:\/\//i.test(url)) throw new Error(`${path}.url must be an http(s) URL`);
  return {
    title: reqStr(raw.title, `${path}.title`),
    url,
    source: reqStr(raw.source, `${path}.source`),
    quote: typeof raw.quote === "string" ? raw.quote : "",
  };
}

/** Parse + validate the model's proposal, enforcing a citation on every change. */
export function parseResearchProposal(raw: unknown): ResearchProposal {
  if (!isObj(raw)) throw new Error("proposal must be an object");
  const changesRaw = Array.isArray(raw.changes) ? raw.changes : [];
  const changes: ProposedChange[] = changesRaw.map((c, i) => {
    const p = `changes[${i}]`;
    if (!isObj(c)) throw new Error(`${p} must be an object`);
    const action = reqStr(c.action, `${p}.action`);
    if (!ACTIONS.has(action)) throw new Error(`${p}.action must be add|modify|remove`);
    const citationsRaw = Array.isArray(c.citations) ? c.citations : [];
    if (citationsRaw.length === 0) {
      // The moat: a proposed compliance change with no regulator source is invalid.
      throw new Error(`${p} must cite at least one regulator source`);
    }
    return {
      category: reqStr(c.category, `${p}.category`),
      action: action as ProposalAction,
      ruleId: typeof c.ruleId === "string" ? c.ruleId : undefined,
      summary: reqStr(c.summary, `${p}.summary`),
      proposedText: typeof c.proposedText === "string" ? c.proposedText : undefined,
      citations: citationsRaw.map((cit, j) => parseCitation(cit, `${p}.citations[${j}]`)),
    };
  });

  const sourcesRaw = Array.isArray(raw.sources) ? raw.sources : [];
  return {
    industry: typeof raw.industry === "string" ? raw.industry : "",
    baseVersion: typeof raw.baseVersion === "string" ? raw.baseVersion : "",
    generatedAt: typeof raw.generatedAt === "string" ? raw.generatedAt : new Date().toISOString(),
    summary: typeof raw.summary === "string" ? raw.summary : "",
    changes,
    sources: sourcesRaw
      .filter(isObj)
      .filter((s) => typeof s.title === "string" && typeof s.url === "string")
      .map((s) => ({ title: s.title as string, url: s.url as string })),
  };
}

/** JSON Schema hint sent to Gemini to steer the structured output. */
export const RESEARCH_PROPOSAL_JSON_SCHEMA = {
  type: "object",
  properties: {
    industry: { type: "string" },
    baseVersion: { type: "string" },
    summary: { type: "string" },
    changes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string" },
          action: { type: "string", enum: ["add", "modify", "remove"] },
          ruleId: { type: "string" },
          summary: { type: "string" },
          proposedText: { type: "string" },
          citations: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                url: { type: "string" },
                source: { type: "string" },
                quote: { type: "string" },
              },
              required: ["title", "url", "source"],
            },
          },
        },
        required: ["category", "action", "summary", "citations"],
      },
    },
    sources: {
      type: "array",
      items: { type: "object", properties: { title: { type: "string" }, url: { type: "string" } }, required: ["title", "url"] },
    },
  },
  required: ["summary", "changes"],
} as const;

export const RESEARCH_PROPOSAL_SCHEMA: OutputSchema<ResearchProposal> = {
  jsonSchema: RESEARCH_PROPOSAL_JSON_SCHEMA,
  parse: parseResearchProposal,
};

// ---- prompt (pure) -------------------------------------------------------

export interface ResearchContext {
  industry: string;
  baseVersion: string;
  /** The current published rules.md, so the agent knows what already exists. */
  rulesMarkdown: string;
  /** ISO date the base version was last reviewed (scan window lower bound). */
  lastReviewed: string | null;
}

export function buildResearchPrompt(ctx: ResearchContext): string {
  return [
    `You are a compliance research analyst for US investment advisers (RIAs).`,
    `The current published ruleset is ${ctx.industry} v${ctx.baseVersion}${ctx.lastReviewed ? `, last reviewed ${ctx.lastReviewed}` : ""}.`,
    ``,
    `TASK: Using web search, scan authoritative regulator sources — SEC.gov (Advisers Act, Marketing Rule 206(4)-1, Form ADV/CRS), FINRA notices, and state securities boards — for rule changes, new guidance, or enforcement trends that would change the ruleset SINCE it was last reviewed.`,
    ``,
    `Return a STRUCTURED diff proposal only. Rules:`,
    `- Propose concrete changes (add / modify / remove) to specific rule categories.`,
    `- EVERY change MUST cite at least one regulator source with a real URL and the supporting quote. Do not propose any change you cannot cite.`,
    `- If nothing material has changed, return an empty "changes" array and say so in "summary".`,
    `- Never fabricate citations. Prefer primary sources (sec.gov, finra.org, state .gov).`,
    ``,
    `CURRENT RULESET (rules.md) for context:`,
    ctx.rulesMarkdown.slice(0, 12_000),
  ].join("\n");
}

// ---- IO (injected Gemini client) -----------------------------------------

/** Minimal structural slice of `GeminiClient` the research agent uses. */
export interface ResearchGemini {
  generateJSON<T>(opts: {
    useCase: GeminiUseCase;
    operation: GeminiOperation;
    schema: OutputSchema<T>;
    prompt: string;
    systemInstruction?: string;
  }): Promise<GenerateJSONResult<T>>;
}

export interface ResearchResult {
  proposal: ResearchProposal;
  costUsd: number;
  model: string;
}

/**
 * Run the research agent against the live regulator web (Gemini Pro + search).
 * Returns a cited proposal + the call cost. Advisory only — no side effects.
 */
export async function runResearchAgent(
  gemini: ResearchGemini,
  ctx: ResearchContext,
): Promise<ResearchResult> {
  const { data, costUsd, model } = await gemini.generateJSON({
    useCase: "research",
    operation: "compliance_research",
    schema: RESEARCH_PROPOSAL_SCHEMA,
    prompt: buildResearchPrompt(ctx),
  });
  // Backfill the context fields the model may omit, so the stored proposal is
  // self-describing regardless of what the model echoed back.
  return {
    proposal: {
      ...data,
      industry: data.industry || ctx.industry,
      baseVersion: data.baseVersion || ctx.baseVersion,
      generatedAt: data.generatedAt || new Date().toISOString(),
    },
    costUsd,
    model,
  };
}
