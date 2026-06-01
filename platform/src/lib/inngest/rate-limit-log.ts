/**
 * Rate-limit logging (CLAUDE.md "Rate Limits & Fallbacks").
 *
 * When an external client throws a rate-limit error during a pipeline step, the
 * pipeline records an append-only entry to `state/rate-limits.md` in addition to
 * letting Inngest back off + retry. Format mirrors the file header:
 *   service · endpoint · limit hit · timestamp · error code · fallback.
 */
import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";

export interface RateLimitEntry {
  service: string;
  endpoint: string;
  timestamp: string;
  code: string;
  fallback: string;
}

/** Default path to the repo's state/rate-limits.md, relative to platform/. */
export const DEFAULT_RATE_LIMIT_LOG = resolve(
  process.cwd(),
  "..",
  "state",
  "rate-limits.md",
);

export function formatRateLimitEntry(entry: RateLimitEntry): string {
  return `- ${entry.service} · ${entry.endpoint} · rate-limited · ${entry.timestamp} · ${entry.code} · ${entry.fallback}`;
}

/**
 * Append a rate-limit entry. Best-effort: a logging failure must never mask the
 * pipeline retry, so callers should not let this reject the step.
 */
export async function appendRateLimitLog(
  entry: RateLimitEntry,
  path: string = DEFAULT_RATE_LIMIT_LOG,
): Promise<void> {
  await appendFile(path, `${formatRateLimitEntry(entry)}\n`, "utf8");
}
