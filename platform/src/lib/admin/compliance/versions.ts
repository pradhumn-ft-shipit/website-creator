/**
 * Ruleset version index for `/admin/compliance` (PRD §11.2).
 *
 * Answers the list view's two questions: *what ruleset versions exist* (current
 * + historical, read from the on-disk `compliance/` artifacts and reconciled
 * with the `compliance_rulesets` publish rows) and *how many live sites are
 * affected by each version* (counted from `generated_content.compliance_version_used`
 * joined out to the owning site).
 *
 * Split into a pure counting/shaping core (unit-tested against fixture rows) and
 * a thin IO edge (`listRulesetVersions`) that reads disk + the service-role DB.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { rulesetVersionString } from "@/lib/compliance";

type AdminClient = SupabaseClient<Database>;

export interface RulesetVersionRow {
  industry: string;
  /** Bare version, e.g. "1.0". */
  version: string;
  /** Path-style version recorded on every consumer artifact, e.g. "ria/v1.0". */
  versionString: string;
  /** manifest.status — "draft" | "approved". */
  status: string;
  approved: boolean;
  reviewers: string[];
  /** True when a `compliance_rulesets` row records this version as published. */
  published: boolean;
  publishedAt: string | null;
  /** Distinct LIVE sites whose current content was built against this version. */
  affectedSiteCount: number;
}

// ---- affected-site counting (pure) ---------------------------------------

/** A generated-content row flattened to the fields the count needs. */
export interface AffectedRow {
  versionString: string;
  siteId: string;
  live: boolean;
}

/** True once for each shape the embedded select can return (renamed or not). */
function pickAccount(order: unknown): unknown {
  if (!order || typeof order !== "object") return null;
  const o = order as Record<string, unknown>;
  return o.account ?? o.accounts ?? null;
}

function pickSites(account: unknown): unknown[] {
  if (!account || typeof account !== "object") return [];
  const a = account as Record<string, unknown>;
  const sites = a.sites;
  return Array.isArray(sites) ? sites : [];
}

/**
 * Flatten the embedded `generated_content → order → account → sites` read into
 * flat `AffectedRow`s. A site is "live" once it has a `last_deployed_at`. One
 * content row can map to several sites (v1: one, but shape-tolerant).
 */
export function flattenAffectedRows(rows: unknown[]): AffectedRow[] {
  const out: AffectedRow[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const versionString = r.compliance_version_used;
    if (typeof versionString !== "string" || versionString === "") continue;
    const order = r.order ?? r.orders ?? null;
    const account = pickAccount(order);
    for (const site of pickSites(account)) {
      if (!site || typeof site !== "object") continue;
      const s = site as Record<string, unknown>;
      if (typeof s.id !== "string") continue;
      out.push({ versionString, siteId: s.id, live: s.last_deployed_at != null });
    }
  }
  return out;
}

/**
 * Count DISTINCT live sites per version string. A site counts once per version
 * even if it has multiple content rows against that version.
 */
export function countLiveSitesByVersion(rows: AffectedRow[]): Record<string, number> {
  const byVersion = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.live) continue;
    let set = byVersion.get(row.versionString);
    if (!set) {
      set = new Set();
      byVersion.set(row.versionString, set);
    }
    set.add(row.siteId);
  }
  const counts: Record<string, number> = {};
  for (const [version, set] of byVersion) counts[version] = set.size;
  return counts;
}

// ---- disk version index (IO edge) ----------------------------------------

interface DiskVersion {
  industry: string;
  version: string;
  status: string;
  approved: boolean;
  reviewers: string[];
}

function defaultComplianceRoot(): string {
  return join(process.cwd(), "..", "compliance");
}

function safeDirs(path: string): string[] {
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("__") && !d.name.startsWith("."))
    .map((d) => d.name);
}

/** Read every `{industry}/v{N}/manifest.json` under the compliance root. */
export function listDiskRulesetVersions(root: string): DiskVersion[] {
  const out: DiskVersion[] = [];
  for (const industry of safeDirs(root)) {
    const industryDir = join(root, industry);
    for (const dir of safeDirs(industryDir)) {
      if (!dir.startsWith("v")) continue;
      const manifestPath = join(industryDir, dir, "manifest.json");
      if (!existsSync(manifestPath)) continue;
      let manifest: Record<string, unknown> = {};
      try {
        manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      } catch {
        // A malformed manifest still lists the version (flagged elsewhere by lint).
      }
      const review = (manifest.review ?? {}) as Record<string, unknown>;
      out.push({
        industry: typeof manifest.industry === "string" ? manifest.industry : industry,
        version: typeof manifest.version === "string" ? manifest.version : dir.replace(/^v/, ""),
        status: typeof manifest.status === "string" ? manifest.status : "draft",
        approved: review.approved === true,
        reviewers: Array.isArray(review.reviewers) ? (review.reviewers as string[]) : [],
      });
    }
  }
  return out;
}

// ---- shaping (pure) ------------------------------------------------------

export interface PublishRow {
  industry: string;
  version: string;
  publishedAt: string | null;
}

/** Merge disk versions + publish rows + affected counts into the list model. */
export function shapeVersions(
  disk: DiskVersion[],
  published: PublishRow[],
  counts: Record<string, number>,
): RulesetVersionRow[] {
  const publishedByKey = new Map(published.map((p) => [`${p.industry}/v${p.version}`, p]));
  return disk
    .map((d) => {
      const versionString = rulesetVersionString(d.industry, d.version);
      const pub = publishedByKey.get(versionString);
      return {
        industry: d.industry,
        version: d.version,
        versionString,
        status: d.status,
        approved: d.approved,
        reviewers: d.reviewers,
        published: pub != null,
        publishedAt: pub?.publishedAt ?? null,
        affectedSiteCount: counts[versionString] ?? 0,
      };
    })
    .sort((a, b) => b.versionString.localeCompare(a.versionString, undefined, { numeric: true }));
}

// ---- IO ------------------------------------------------------------------

const AFFECTED_SELECT =
  "compliance_version_used, order:orders ( account:accounts ( sites ( id, last_deployed_at ) ) )";

/**
 * The full `/admin/compliance` version list: on-disk versions reconciled with
 * their publish rows, each carrying its live-sites-affected count. Service-role
 * reads (compliance_rulesets / generated_content are RLS-internal).
 */
export async function listRulesetVersions(opts: {
  client?: AdminClient;
  complianceRoot?: string;
} = {}): Promise<RulesetVersionRow[]> {
  const client = opts.client ?? createAdminClient();
  const root = opts.complianceRoot ?? defaultComplianceRoot();

  const disk = listDiskRulesetVersions(root);

  const { data: pubData, error: pubError } = await client
    .from("compliance_rulesets")
    .select("industry, version, published_at");
  if (pubError) throw pubError;
  const published: PublishRow[] = ((pubData ?? []) as Array<{ industry: string; version: string; published_at: string | null }>).map(
    (r) => ({ industry: r.industry, version: r.version, publishedAt: r.published_at }),
  );

  const { data: gcData, error: gcError } = await client
    .from("generated_content")
    .select(AFFECTED_SELECT);
  if (gcError) throw gcError;
  const counts = countLiveSitesByVersion(flattenAffectedRows((gcData ?? []) as unknown[]));

  return shapeVersions(disk, published, counts);
}
