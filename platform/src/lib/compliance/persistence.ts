/**
 * Compliance persistence (PRD §5.6, §5.2) — the DB IO edge for the compliance
 * engine. Two service-role writes:
 *
 *   - `mirrorRuleset` mirrors the active versioned ruleset artifact into the
 *     `compliance_rulesets` table for runtime lookup (§5.6). Rulesets are
 *     immutable (002's before-update trigger blocks content edits), so this
 *     inserts the version once and is a no-op if it already exists — never an
 *     UPDATE that the trigger would reject.
 *   - `recordViolations` writes one `compliance_violations` row per Layer-2
 *     violation (§5.2), tagged with the ruleset version + field path + severity,
 *     attached to either the order (generation) or the edit (edit chat).
 *
 * `compliance_rulesets` / `compliance_violations` are RLS-internal tables, so
 * all access here is via the service-role client (never the cookie client).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { AppError } from "@/lib/api/envelope";
import type { Database } from "@/types/database.types";
import { createAdminClient } from "@/lib/supabase/admin";

import type { LoadedRuleset } from "./ruleset";
import type { Violation } from "./validator";

type AdminClient = SupabaseClient<Database>;

export interface MirrorResult {
  id: string;
  /** True if this call inserted the row; false if it was already mirrored. */
  created: boolean;
}

/**
 * Mirror a loaded ruleset into `compliance_rulesets` for runtime lookup. Inserts
 * the (industry, version) row once; if it already exists, returns it unchanged
 * (rulesets are immutable artifacts — the source of truth stays on disk).
 */
export async function mirrorRuleset(
  client: AdminClient,
  loaded: LoadedRuleset,
): Promise<MirrorResult> {
  const { data: existing, error: selectError } = await client
    .from("compliance_rulesets")
    .select("id")
    .eq("industry", loaded.industry)
    .eq("version", loaded.version)
    .is("sub_industry", null)
    .maybeSingle();

  if (selectError) {
    throw new AppError("Failed to look up the compliance ruleset.", "ruleset_lookup_failed", 500);
  }
  if (existing) {
    return { id: (existing as { id: string }).id, created: false };
  }

  const { data, error } = await client
    .from("compliance_rulesets")
    .insert({
      industry: loaded.industry,
      sub_industry: null,
      version: loaded.version,
      rules_json: loaded.rules as unknown as Database["public"]["Tables"]["compliance_rulesets"]["Insert"]["rules_json"],
      rules_markdown: loaded.rulesMarkdown,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new AppError("Failed to mirror the compliance ruleset.", "ruleset_mirror_failed", 500);
  }
  return { id: (data as { id: string }).id, created: true };
}

export interface RecordViolationsInput {
  /** Attach to a generation order (020) … */
  orderId?: string;
  /** … or to a post-launch edit (029). One of orderId/editId should be set. */
  editId?: string;
  /** The ruleset version validated against (recorded on every row). */
  rulesetVersion: string;
  violations: Violation[];
}

export interface RecordViolationsResult {
  inserted: number;
  ids: string[];
}

/**
 * Write Layer-2 violations to `compliance_violations` (§5.2). One row per
 * violation, tagged with severity + field path + ruleset version. Empty input
 * is a no-op (a passing site writes nothing).
 */
export async function recordViolations(
  client: AdminClient,
  input: RecordViolationsInput,
): Promise<RecordViolationsResult> {
  if (input.violations.length === 0) {
    return { inserted: 0, ids: [] };
  }

  const rows = input.violations.map((v) => ({
    order_id: input.orderId ?? null,
    edit_id: input.editId ?? null,
    ruleset_version: input.rulesetVersion,
    severity: v.severity,
    field_path: v.fieldPath,
    violation_description: v.description,
  }));

  const { data, error } = await client
    .from("compliance_violations")
    .insert(rows)
    .select("id");

  if (error || !data) {
    throw new AppError("Failed to record compliance violations.", "violation_write_failed", 500);
  }
  const ids = (data as Array<{ id: string }>).map((r) => r.id);
  return { inserted: ids.length, ids };
}

// ---- wired entry points (real service-role client) ----

export function mirrorRulesetWithClient(loaded: LoadedRuleset) {
  return mirrorRuleset(createAdminClient(), loaded);
}

export function recordViolationsWithClient(input: RecordViolationsInput) {
  return recordViolations(createAdminClient(), input);
}
