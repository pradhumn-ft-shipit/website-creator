/**
 * Post-publish re-validation (PRD §5.6, §5.8, §11.2/§11.3) — the seam into the
 * 034 `/admin/compliance/violations` queue.
 *
 * When a new ruleset version is published, every LIVE site built against an
 * older version must be re-checked against the new rules. This module:
 *   1. selects the affected sites (pure `planRevalidation`), and
 *   2. records the outcome of re-validating one site into the two artifacts the
 *      034 queue reads: `compliance_violations` rows (the queue itself) + a
 *      `compliance_review` admin_alert (the inbox surface).
 *
 * The Inngest function (`lib/inngest/compliance.ts`) drives the loop: per target
 * it loads the site's current content, runs Layer 2 (`runLayer2`) against the
 * new version, then calls `recordRevalidationResult` here. That keeps the AI /
 * DB boundaries injectable and the selection logic unit-testable in isolation.
 *
 * === 034 QUEUE INTERFACE (the seam 034 consumes) ===
 *   • `compliance_violations` — one unresolved row per flagged field, tagged with
 *     the NEW ruleset version, severity, field path, order/edit id. 034's queue
 *     view lists unresolved rows and resolves them (approve fix / regenerate /
 *     edit / dismiss).
 *   • `admin_alerts (type='compliance_review')` — one row per flagged site so the
 *     site surfaces in the admin inbox with a link into the queue.
 * 034 only READS these; this module (via publish → Inngest) WRITES them.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { AppError } from "@/lib/api/envelope";
import type { Database } from "@/types/database.types";
import { recordViolations, type RecordViolationsResult } from "@/lib/compliance";
import type { Violation } from "@/lib/compliance";

import { flattenAffectedRows } from "./versions";

type AdminClient = SupabaseClient<Database>;

/** A single site scheduled for re-validation against the new ruleset version. */
export interface RevalidationTarget {
  orderId: string;
  siteId: string;
  /** The version the site is currently built against (what we're upgrading from). */
  fromVersion: string;
}

/**
 * Select the live sites that need re-checking after publishing `newVersionString`:
 * every live site whose current content was built against a DIFFERENT (older)
 * version. Pure — takes the flattened generated-content rows + the target order
 * ids so callers can map site → its order.
 */
export function planRevalidation(
  generatedContentRows: unknown[],
  siteToOrder: Record<string, string>,
  newVersionString: string,
): RevalidationTarget[] {
  const seen = new Set<string>();
  const targets: RevalidationTarget[] = [];
  for (const row of flattenAffectedRows(generatedContentRows)) {
    if (!row.live) continue;
    if (row.versionString === newVersionString) continue; // already current
    if (seen.has(row.siteId)) continue;
    const orderId = siteToOrder[row.siteId];
    if (!orderId) continue;
    seen.add(row.siteId);
    targets.push({ orderId, siteId: row.siteId, fromVersion: row.versionString });
  }
  return targets;
}

export interface RevalidationOutcome {
  siteId: string;
  orderId: string;
  newVersion: string;
  violations: Violation[];
}

/**
 * Record the result of re-validating one site into the 034 queue: write any
 * violations (tagged with the new version) + raise a `compliance_review` alert.
 * A clean site writes neither — nothing to review. Returns what was queued.
 */
export async function recordRevalidationResult(
  client: AdminClient,
  outcome: RevalidationOutcome,
): Promise<{ violations: RecordViolationsResult; flagged: boolean }> {
  if (outcome.violations.length === 0) {
    return { violations: { inserted: 0, ids: [] }, flagged: false };
  }

  const violations = await recordViolations(client, {
    orderId: outcome.orderId,
    rulesetVersion: outcome.newVersion,
    violations: outcome.violations,
  });

  const highest = outcome.violations.some((v) => v.severity === "high")
    ? "high"
    : outcome.violations.some((v) => v.severity === "medium")
      ? "medium"
      : "low";

  const { error } = await client.from("admin_alerts").insert({
    type: "compliance_review",
    site_id: outcome.siteId,
    payload_json: {
      reason: "ruleset_republish",
      new_version: outcome.newVersion,
      violation_count: outcome.violations.length,
      severity: highest,
    } as Database["public"]["Tables"]["admin_alerts"]["Insert"]["payload_json"],
  });
  if (error) {
    throw new AppError("Failed to raise the compliance-review alert.", "alert_write_failed", 500);
  }

  return { violations, flagged: true };
}
