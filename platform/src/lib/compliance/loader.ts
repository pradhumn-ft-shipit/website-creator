/**
 * Compliance ruleset loader (PRD §5.6) — the IO edge that reads the versioned
 * `compliance/{industry}/v{version}/` artifacts authored in ticket 005 off disk
 * and hands them to the pure resolver in `ruleset.ts`.
 *
 * fs lives only here (`loadRuleset`); parsing, overlay resolution, and prompt
 * rendering are pure (`ruleset.ts`) and unit-tested without disk — the same
 * pure/IO split as the prompt loader (`lib/prompts/loader.ts`) and auth.
 *
 * The artifact tree sits at the repo root, one level up from the platform cwd,
 * so the default `dir` resolves to `<cwd>/../compliance`. It is injectable so
 * tests point at the real tree (catching drift between the validator and the
 * authored ruleset) without hard-coding an absolute path.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  parseRulesJson,
  resolveRuleset,
  type LoadedRuleset,
  type Registration,
  type ResolvedRuleset,
} from "./ruleset";

/** The only RIA ruleset shipped in v1 (PRD §5.3). */
export const ACTIVE_RIA_INDUSTRY = "ria";
export const ACTIVE_RIA_VERSION = "1.0";

interface ManifestShape {
  disclosures?: { footer_standard?: string };
  state_overlays?: Array<{ state?: string; file?: string }>;
}

/** Default compliance root: the repo-level `compliance/` dir, up from platform cwd. */
function defaultDir(): string {
  return join(process.cwd(), "..", "compliance");
}

function readText(path: string, label: string, version: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    throw new Error(
      `loadRuleset: ${label} for ruleset v${version} not found at ${path}`,
    );
  }
}

function readJson(path: string, label: string, version: string): unknown {
  const raw = readText(path, label, version);
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `loadRuleset: ${label} for ruleset v${version} is not valid JSON (${path}): ${(err as Error).message}`,
    );
  }
}

export interface LoadRulesetOptions {
  industry?: string;
  version?: string;
  /** Override the compliance root (defaults to `<cwd>/../compliance`). */
  dir?: string;
}

/**
 * Read + parse one versioned ruleset's artifacts: `rules.json` (typed),
 * `rules.md` (raw, for the DB mirror), the standard footer template, and every
 * state overlay listed in `manifest.json`. Throws (naming the artifact +
 * version) if anything is missing.
 */
export function loadRuleset(opts: LoadRulesetOptions = {}): LoadedRuleset {
  const industry = opts.industry ?? ACTIVE_RIA_INDUSTRY;
  const version = opts.version ?? ACTIVE_RIA_VERSION;
  const versionDir = join(opts.dir ?? defaultDir(), industry, `v${version}`);

  const rules = parseRulesJson(
    readJson(join(versionDir, "rules.json"), "rules.json", version),
  );
  const rulesMarkdown = readText(join(versionDir, "rules.md"), "rules.md", version);
  const manifest = readJson(join(versionDir, "manifest.json"), "manifest.json", version) as ManifestShape;

  const footerRel = manifest.disclosures?.footer_standard ?? "disclosures/footer-standard.md";
  const footerTemplate = readText(join(versionDir, footerRel), "footer template", version);

  const overlays: Record<string, string> = {};
  for (const entry of manifest.state_overlays ?? []) {
    if (!entry.state || !entry.file) continue;
    overlays[entry.state.toUpperCase()] = readText(
      join(versionDir, entry.file),
      `state overlay ${entry.state}`,
      version,
    );
  }

  return { industry, version, rules, rulesMarkdown, footerTemplate, overlays };
}

export interface ResolveRulesetOptions extends LoadRulesetOptions {
  registration: Registration;
  primaryState?: string | null;
}

/**
 * Load the active ruleset off disk and resolve it for one adviser — the entry
 * point callers (020/029/031) use to get a `ResolvedRuleset` ready to validate
 * against. Defaults to the active RIA industry/version.
 */
export function loadAndResolveRuleset(opts: ResolveRulesetOptions): ResolvedRuleset {
  const loaded = loadRuleset(opts);
  return resolveRuleset(loaded, {
    registration: opts.registration,
    primaryState: opts.primaryState,
  });
}
