/**
 * Server-only wiring for the compliance admin tool: the real filesystem
 * artifact writer, the bridge to the `lint:rulesets` validator (005, a
 * zero-dependency ESM module under `compliance/scripts/`), and the fully-wired
 * `publishDraft` / research-agent entry points.
 *
 * Kept out of the pure modules so those stay import-clean + unit-testable; this
 * is the one place node fs + the real Gemini client + Inngest are stitched in.
 */

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { createAdminClient } from "@/lib/supabase/admin";
import { geminiClient } from "@/lib/gemini";
import { inngest } from "@/lib/inngest/client";
import { ACTIVE_RIA_INDUSTRY, ACTIVE_RIA_VERSION } from "@/lib/compliance";

import { publishDraft, type ArtifactWriter, type PublishResult, type RulesetLinter } from "./publish";
import { runResearchAgent, type ResearchProposal } from "./research";

/** Absolute path to the repo `compliance/` root (one level up from platform cwd). */
export function complianceRoot(): string {
  return join(process.cwd(), "..", "compliance");
}

/** Real fs writer used at publish time. */
export const nodeArtifactWriter: ArtifactWriter = {
  exists: (p) => existsSync(p),
  ensureDir: (p) => mkdirSync(p, { recursive: true }),
  writeFile: (p, c) => writeFileSync(p, c, "utf8"),
  copyDir: (s, d) => {
    if (existsSync(s)) cpSync(s, d, { recursive: true });
  },
};

/**
 * Load the `lint:rulesets` validator (005) and return a sync linter over a
 * version dir. Imported lazily (it's an .mjs sibling of the compliance root) so
 * the app doesn't pull it in unless a publish actually happens.
 */
export async function loadRulesetLinter(): Promise<RulesetLinter> {
  const lintPath = join(complianceRoot(), "scripts", "lint.mjs");
  const mod = (await import(pathToFileURL(lintPath).href)) as {
    lintRuleset: (dir: string) => { ok: boolean; errors: string[] };
  };
  return (versionDir: string) => mod.lintRuleset(versionDir);
}

/** Fully-wired publish: enforces the two-person gate, writes artifacts, mirrors, queues re-validation. */
export async function publishDraftWired(args: {
  draftId: string;
  publisherId: string | null;
  publisherEmail: string;
}): Promise<PublishResult> {
  const lint = await loadRulesetLinter();
  return publishDraft(
    {
      client: createAdminClient(),
      writer: nodeArtifactWriter,
      lint,
      send: (event) => inngest.send(event),
      complianceRoot: complianceRoot(),
    },
    args,
  );
}

/** Read the current published rules.md for research context (best-effort). */
function readActiveRulesMarkdown(): { markdown: string; lastReviewed: string | null } {
  const versionDir = join(complianceRoot(), ACTIVE_RIA_INDUSTRY, `v${ACTIVE_RIA_VERSION}`);
  let markdown = "";
  let lastReviewed: string | null = null;
  try {
    markdown = readFileSync(join(versionDir, "rules.md"), "utf8");
  } catch {
    markdown = "";
  }
  try {
    const manifest = JSON.parse(readFileSync(join(versionDir, "manifest.json"), "utf8"));
    lastReviewed = typeof manifest.last_reviewed === "string" ? manifest.last_reviewed : null;
  } catch {
    lastReviewed = null;
  }
  return { markdown, lastReviewed };
}

/**
 * Fully-wired research agent: reads the active ruleset for context and runs the
 * live Gemini Pro + search scan. Never publishes — returns a proposal.
 */
export async function runResearchAgentWired(opts: {
  industry?: string;
  baseVersion?: string;
} = {}): Promise<ResearchProposal> {
  const industry = opts.industry ?? ACTIVE_RIA_INDUSTRY;
  const baseVersion = opts.baseVersion ?? ACTIVE_RIA_VERSION;
  const { markdown, lastReviewed } = readActiveRulesMarkdown();
  const { proposal } = await runResearchAgent(geminiClient(), {
    industry,
    baseVersion,
    rulesMarkdown: markdown,
    lastReviewed,
  });
  return proposal;
}
