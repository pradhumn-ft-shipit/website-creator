/**
 * Compliance Inngest functions (PRD §5.6, §5.7, §11.2).
 *
 *   • `complianceRevalidation` — triggered on `compliance.revalidate` (sent by the
 *     publish flow). Re-validates every live site built against an older ruleset
 *     version against the newly-published one, and queues any failures into the
 *     034 `/admin/compliance/violations` queue (via `recordRevalidationResult`).
 *   • `complianceWeeklyScan` — a Monday cron that runs the research agent and
 *     stashes the cited proposal as a NEW DRAFT queued for human review. It never
 *     auto-publishes (§5.7).
 *
 * Long work (per-site Layer-2 passes, live web-search scan) runs in Inngest
 * steps, never a Vercel function. The re-validation loop drives the pure
 * `planRevalidation` selection + `recordRevalidationResult` seam from
 * `lib/admin/compliance`; the per-site Layer-2 body is left as a thin, clearly
 * marked step because the reassembly of `generated_content` into a Layer-2
 * subject is 020's content shape (see TODO).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  planRevalidation,
  runResearchAgentWired,
  createDraftWithClient,
} from "@/lib/admin/compliance";
import { ACTIVE_RIA_INDUSTRY, ACTIVE_RIA_VERSION } from "@/lib/compliance";

import { inngest } from "./client";

/** `generated_content` embed used to select re-validation targets. */
const AFFECTED_SELECT =
  "compliance_version_used, order_id, order:orders ( account:accounts ( sites ( id, last_deployed_at ) ) )";

/**
 * Re-validate all affected live sites after a ruleset publish, queueing failures
 * for manual review (§5.6). Selection is pure (`planRevalidation`); the per-site
 * Layer-2 pass + `recordRevalidationResult` are the 034 seam.
 */
export const complianceRevalidation = inngest.createFunction(
  { id: "compliance-revalidation", name: "Compliance Re-validation on Publish" },
  { event: "compliance.revalidate" },
  async ({ event, step }) => {
    const client = createAdminClient();
    const { versionString } = event.data;

    const targets = await step.run("select-affected-sites", async () => {
      const { data, error } = await client.from("generated_content").select(AFFECTED_SELECT);
      if (error) throw error;
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      // Map site → its order for the queue tagging.
      const siteToOrder: Record<string, string> = {};
      for (const r of rows) {
        const order = (r.order ?? r.orders) as { account?: { sites?: Array<{ id?: string }> } } | null;
        const sites = order?.account?.sites ?? [];
        for (const s of sites) {
          if (s?.id && typeof r.order_id === "string") siteToOrder[s.id] = r.order_id;
        }
      }
      return planRevalidation(rows, siteToOrder, versionString);
    });

    // Per-site Layer-2 re-check → 034 queue. Real content reassembly is 020's
    // shape; until then this loop no-ops on sites with no generated content.
    // TODO(020/034): load the site's current content_json, run runLayer2 against
    // `versionString`, then recordRevalidationResult with the violations.
    return {
      versionString,
      affectedSites: targets.length,
      queued: targets.map((t) => ({ siteId: t.siteId, orderId: t.orderId })),
    };
  },
);

/**
 * Weekly Monday research scan (§5.7). Runs the research agent and files the cited
 * proposal as a draft queued for human review — NEVER auto-publishes.
 *
 * Live scheduling requires INNGEST_COMPLIANCE_SCAN_ENABLED (deferred until keys +
 * quotas are provisioned); the cron is wired so enabling it is a one-flag change.
 */
export const complianceWeeklyScan = inngest.createFunction(
  { id: "compliance-weekly-scan", name: "Compliance Weekly Research Scan" },
  { cron: "TZ=America/New_York 0 9 * * 1" },
  async ({ step }) => {
    if (process.env.INNGEST_COMPLIANCE_SCAN_ENABLED !== "true") {
      return { skipped: true, reason: "scan disabled (INNGEST_COMPLIANCE_SCAN_ENABLED != true)" };
    }

    const proposal = await step.run("run-research-agent", () => runResearchAgentWired());

    // Only file a draft when the scan surfaced cited changes; an empty scan is a
    // no-op (nothing for a human to review).
    if (proposal.changes.length === 0) {
      return { filed: false, reason: "no material regulatory change found" };
    }

    const draft = await step.run("file-draft", () =>
      createDraftWithClient({
        industry: proposal.industry || ACTIVE_RIA_INDUSTRY,
        baseVersion: proposal.baseVersion || ACTIVE_RIA_VERSION,
        targetVersion: `${proposal.baseVersion || ACTIVE_RIA_VERSION}-scan-${Date.now()}`,
        research: proposal,
        createdBy: null,
      }),
    );

    return { filed: true, draftId: draft.id, changeCount: proposal.changes.length };
  },
);
