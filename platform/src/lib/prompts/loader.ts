/**
 * Versioned prompt loader (PRD §8.2.6) — the one place generation prompts are
 * read from. Prompts live as markdown under `prompts/v{N}/<name>.md` with a
 * small frontmatter block; the compliance rulebook and brand voice are NOT
 * baked into the file — they are `{{slots}}` filled at call time via
 * `assemblePrompt`, so the rulebook always rides in the *system* instruction
 * (§8.2.2, survives prompt injection from scraped content).
 *
 * `loadPrompt(...).ref` ("generate-site@v1") is the version string callers
 * persist on `generated_content` so every generated row is traceable to the
 * exact prompt that produced it (§8.2.6). The eval harness (007) loads prompts
 * through this same module, so a prompt that fails to parse fails the gate.
 *
 * fs is the only IO and sits at the edge (`loadPrompt`); the parsing and
 * slot-substitution logic is pure (`parsePromptFile`, `assemblePrompt`) and
 * unit-tested without touching disk.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The prompt-set version. Matches the `prompts/v1/` directory. */
export const PROMPT_VERSION = "v1";

/** Canonical prompt names — one markdown file each under `prompts/v1/`. */
export const PROMPT_NAMES = [
  "generate-site",
  "edit-chat",
  "layer2-validate",
  "blog-check",
] as const;

export type PromptName = (typeof PROMPT_NAMES)[number];

export interface LoadedPrompt {
  name: string;
  /** The prompt-set version, e.g. "v1". */
  version: string;
  /** Persistable reference, e.g. "generate-site@v1" (§8.2.6 traceability). */
  ref: string;
  /** The prompt body (frontmatter stripped), with `{{slots}}` intact. */
  text: string;
  frontmatter: Record<string, string>;
}

/** Default prompts root, resolved from the platform cwd. */
function defaultDir(): string {
  return join(process.cwd(), "prompts");
}

/**
 * Split a prompt markdown file into its `key: value` frontmatter and body.
 * Frontmatter is the leading `---\n…\n---` block; absent → empty map, whole
 * file is the body. Pure (no IO).
 */
export function parsePromptFile(raw: string): {
  frontmatter: Record<string, string>;
  body: string;
} {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: raw };

  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (key) frontmatter[key] = line.slice(idx + 1).trim();
  }
  return { frontmatter, body: match[2] };
}

/**
 * Fill every `{{slot}}` in a prompt's text from `vars`. Fail-loud (§8.2.7):
 * a slot left unfilled (caller forgot e.g. the ruleset) OR a var that matches
 * no slot (typo) both throw — there is no silent passthrough.
 */
export function assemblePrompt(
  prompt: { text: string; ref?: string },
  vars: Record<string, string>,
): string {
  const slots = new Set<string>();
  const filled = prompt.text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_m, slot: string) => {
    slots.add(slot);
    if (!(slot in vars)) {
      throw new Error(
        `assemblePrompt(${prompt.ref ?? "?"}): missing value for slot "${slot}"`,
      );
    }
    return vars[slot];
  });

  for (const key of Object.keys(vars)) {
    if (!slots.has(key)) {
      throw new Error(
        `assemblePrompt(${prompt.ref ?? "?"}): var "${key}" matches no slot`,
      );
    }
  }
  return filled;
}

/**
 * Read and parse a versioned prompt. `dir` defaults to `<cwd>/prompts` and is
 * injectable for tests. Throws (naming the file) if it is missing.
 */
export function loadPrompt(
  name: string,
  opts: { dir?: string; version?: string } = {},
): LoadedPrompt {
  const version = opts.version ?? PROMPT_VERSION;
  const dir = opts.dir ?? defaultDir();
  const path = join(dir, version, `${name}.md`);

  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new Error(`loadPrompt: prompt "${name}" not found at ${path}`);
  }

  const { frontmatter, body } = parsePromptFile(raw);
  return {
    name,
    version,
    ref: `${name}@${version}`,
    text: body,
    frontmatter,
  };
}
