/**
 * Admin orders control-room data layer (PRD §11.1, §13.2, §13.4).
 *
 * The single module behind `/admin/orders`: it reads the order queue (joined to
 * the owning firm + the unresolved `admin_alerts` that make a row actionable),
 * classifies each order's state for color-coding, and owns the two recovery
 * actions — one-click **Retry** (reset + re-enqueue the build) and **Dismiss**
 * (resolve the alert without re-running).
 *
 * Split, as elsewhere in the repo, into a pure core (classification, shaping,
 * filtering — exhaustively unit-tested) and a thin IO boundary that talks to the
 * service-role client. `admin_alerts` / `orders` are RLS-internal tables, so all
 * reads/writes here go through the service-role client (never the cookie client).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { AppError } from "@/lib/api/envelope";
import type { Database } from "@/types/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";
import { isFailureState, type OrderState } from "@/lib/orders/state-machine";
import { recordStateEvent } from "@/lib/orders/transitions";

type AdminClient = SupabaseClient<Database>;

// ---- classification (pure) ----------------------------------------------

export type StateTone = "neutral" | "info" | "warning" | "success" | "danger";
export type StateGroup = "in_progress" | "needs_review" | "failed" | "complete";

/** Order statuses that mean "a human needs to look at this" (§11.1 needs-review filter). */
const REVIEW_STATES = new Set([
  "copy_review",
  "revision_requested",
  "compliance_review_layer2",
  "compliance_review_layer3",
  "compliance_review_failed",
  "admin_review_required",
  "admin_queue",
]);

/** Terminal-good statuses — the build reached (or is maintaining) a live site. */
const COMPLETE_STATES = new Set(["deployed", "email_sent", "live", "dns_monitoring"]);

export function stateGroup(status: string): StateGroup {
  if (isFailureState(status as OrderState)) return "failed";
  if (REVIEW_STATES.has(status)) return "needs_review";
  if (COMPLETE_STATES.has(status)) return "complete";
  return "in_progress";
}

export function stateTone(status: string): StateTone {
  switch (stateGroup(status)) {
    case "failed":
      return "danger";
    case "needs_review":
      return "warning";
    case "complete":
      return "success";
    default:
      return "info";
  }
}

/** "generation_failed" → "Generation failed" for table display. */
export function humanizeStatus(status: string): string {
  const spaced = status.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Compact human duration for the "time in state" column. */
export function formatDuration(ms: number): string {
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    const rem = mins % 60;
    return rem ? `${hours}h ${rem}m` : `${hours}h`;
  }
  return `${Math.floor(hours / 24)}d`;
}

// ---- shaping (pure) ------------------------------------------------------

type RawAlert = {
  id: string;
  type: string | null;
  payload_json: unknown;
  created_at: string;
  resolved_at: string | null;
};

/** The joined row shape returned by `listAdminOrders`'s embedded select. */
export type RawAdminOrderRow = {
  id: string;
  status: string;
  failure_reason: string | null;
  retry_count: number;
  created_at: string;
  completed_at: string | null;
  accounts: { firm_name: string | null; users: { email: string | null } | null } | null;
  admin_alerts: RawAlert[] | null;
  /** Latest-entered-state timestamps (033 Slice 2) for precise time-in-state. */
  order_state_events?: { occurred_at: string }[] | null;
};

export type AdminAlertSummary = {
  id: string;
  type: string | null;
  step: string | null;
  message: string | null;
  createdAt: string;
};

export type AdminOrder = {
  id: string;
  status: string;
  stateLabel: string;
  tone: StateTone;
  group: StateGroup;
  firmName: string | null;
  email: string | null;
  createdAt: string;
  /** ms since the order entered its current state (approx — see note in shape). */
  timeInStateMs: number;
  lastFailureReason: string | null;
  retryCount: number;
  /** The unresolved order_failed alert that makes this row actionable, if any. */
  alert: AdminAlertSummary | null;
  retriable: boolean;
};

export type AdminOrderFilters = {
  /** "all" (default), a specific group, or "attention" (has an unresolved alert). */
  group?: StateGroup | "all" | "attention";
  /** Case-insensitive substring match on firm name OR owner email. */
  account?: string;
  /** ISO date (inclusive lower bound on created_at). */
  from?: string;
  /** ISO date (inclusive upper bound on created_at). */
  to?: string;
};

function readPayloadField(payload: unknown, key: string): string | null {
  if (payload && typeof payload === "object" && key in payload) {
    const value = (payload as Record<string, unknown>)[key];
    return typeof value === "string" ? value : null;
  }
  return null;
}

/** The most-recent unresolved `order_failed` alert, or null. */
function pickActionableAlert(alerts: RawAlert[]): AdminAlertSummary | null {
  const open = alerts
    .filter((a) => a.type === "order_failed" && a.resolved_at === null)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const latest = open[0];
  if (!latest) return null;
  return {
    id: latest.id,
    type: latest.type,
    step: readPayloadField(latest.payload_json, "step"),
    message: readPayloadField(latest.payload_json, "message"),
    createdAt: latest.created_at,
  };
}

/** Most-recent `occurred_at` across the order's state-history events, or null. */
function latestEventTime(
  events: { occurred_at: string }[] | null | undefined,
): string | null {
  if (!events || events.length === 0) return null;
  return events.reduce(
    (latest, e) => (Date.parse(e.occurred_at) > Date.parse(latest) ? e.occurred_at : latest),
    events[0].occurred_at,
  );
}

function shapeOne(raw: RawAdminOrderRow, nowMs: number): AdminOrder {
  const alert = pickActionableAlert(raw.admin_alerts ?? []);
  // Time-in-state: prefer the precise timestamp the order entered its current
  // state — the latest state-history event (033 Slice 2). When no events exist
  // yet (orders created before the history table, or none recorded), fall back
  // to the failure alert (accurate for the rows admins act on), else creation.
  const referenceIso =
    latestEventTime(raw.order_state_events) ??
    (alert ? alert.createdAt : raw.created_at);
  return {
    id: raw.id,
    status: raw.status,
    stateLabel: humanizeStatus(raw.status),
    tone: stateTone(raw.status),
    group: stateGroup(raw.status),
    firmName: raw.accounts?.firm_name ?? null,
    email: raw.accounts?.users?.email ?? null,
    createdAt: raw.created_at,
    timeInStateMs: Math.max(0, nowMs - Date.parse(referenceIso)),
    lastFailureReason: raw.failure_reason ?? alert?.message ?? null,
    retryCount: raw.retry_count,
    alert,
    retriable: isFailureState(raw.status as OrderState),
  };
}

function matchesFilters(order: AdminOrder, filters: AdminOrderFilters): boolean {
  const { group, account, from, to } = filters;
  if (group && group !== "all") {
    if (group === "attention") {
      if (!order.alert) return false;
    } else if (order.group !== group) {
      return false;
    }
  }
  if (account) {
    const needle = account.trim().toLowerCase();
    const haystack = `${order.firmName ?? ""} ${order.email ?? ""}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  const created = Date.parse(order.createdAt);
  if (from && created < Date.parse(from)) return false;
  if (to && created > Date.parse(`${to}T23:59:59.999Z`)) return false;
  return true;
}

/** Shape, filter, and sort (newest first) a batch of joined rows. */
export function shapeAdminOrders(
  rows: RawAdminOrderRow[],
  filters: AdminOrderFilters,
  nowMs: number,
): AdminOrder[] {
  return rows
    .map((r) => shapeOne(r, nowMs))
    .filter((o) => matchesFilters(o, filters))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

// ---- detail view (pure) --------------------------------------------------
// The §11.1 order detail view: full state-machine history, intake summary,
// generated-content preview, compliance violations, and deployment logs.

export type OrderStateEvent = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  occurredAt: string;
  note: string | null;
};

/** One state the order occupied, with how long it stayed (the current one runs to `now`). */
export type StateHistoryEntry = {
  status: string;
  label: string;
  tone: StateTone;
  enteredAt: string;
  durationMs: number;
  note: string | null;
  isCurrent: boolean;
};

export type IntakeSummary = {
  existingSiteUrl: string | null;
  hasScrapeResult: boolean;
  uploadedDocCount: number;
  hasStructuredIntake: boolean;
};

export type ContentPiece = {
  id: string;
  version: number;
  page: string;
  section: string | null;
  confidenceScore: number | null;
  complianceVersionUsed: string | null;
  generatedAt: string;
  approved: boolean;
};

export type ViolationSummary = {
  id: string;
  severity: string | null;
  fieldPath: string | null;
  description: string | null;
  rulesetVersion: string | null;
  resolved: boolean;
  resolutionAction: string | null;
};

export type DeploymentLog = {
  id: string;
  status: string | null;
  contentVersion: number | null;
  triggeredBy: string | null;
  compliancePassed: boolean | null;
  vercelDeploymentId: string | null;
  deployedAt: string | null;
};

export type AdminOrderDetail = {
  id: string;
  status: string;
  stateLabel: string;
  tone: StateTone;
  group: StateGroup;
  firmName: string | null;
  email: string | null;
  createdAt: string;
  completedAt: string | null;
  retryCount: number;
  failureReason: string | null;
  retriable: boolean;
  alert: AdminAlertSummary | null;
  history: StateHistoryEntry[];
  intake: IntakeSummary | null;
  content: ContentPiece[];
  violations: ViolationSummary[];
  deployments: DeploymentLog[];
};

type RawDeployment = {
  id: string;
  status: string | null;
  content_version: number | null;
  triggered_by: string | null;
  compliance_check_passed: boolean | null;
  vercel_deployment_id: string | null;
  deployed_at: string | null;
};

type RawSite = { deployments: RawDeployment[] | null };

type RawIntake = {
  existing_site_url: string | null;
  scrape_result_json: unknown;
  uploaded_doc_paths: string[] | null;
  structured_intake_json: unknown;
};

type RawContent = {
  id: string;
  version: number;
  page: string;
  section: string | null;
  confidence_score: number | null;
  compliance_version_used: string | null;
  generated_at: string;
  approved_at: string | null;
};

type RawViolation = {
  id: string;
  severity: string | null;
  field_path: string | null;
  violation_description: string | null;
  ruleset_version: string | null;
  resolved_at: string | null;
  resolution_action: string | null;
};

type RawStateEvent = {
  id: string;
  from_status: string | null;
  to_status: string;
  occurred_at: string;
  note: string | null;
};

export type RawAdminOrderDetail = {
  id: string;
  status: string;
  failure_reason: string | null;
  retry_count: number;
  created_at: string;
  completed_at: string | null;
  accounts:
    | {
        firm_name: string | null;
        users: { email: string | null } | null;
        sites: RawSite[] | null;
      }
    | null;
  intake_data: RawIntake[] | null;
  generated_content: RawContent[] | null;
  compliance_violations: RawViolation[] | null;
  order_state_events: RawStateEvent[] | null;
  admin_alerts: RawAlert[] | null;
};

/**
 * Build the ordered state-machine timeline (§11.1). The order starts in its
 * initial state at `created_at`; each recorded event marks entry into the next
 * state. Each entry's duration runs to the next entry — the current (last) one
 * runs to `now`. With no events yet, the order has been in its current state
 * since creation.
 */
export function buildStateHistory(
  createdAt: string,
  events: OrderStateEvent[],
  currentStatus: string,
  nowMs: number,
): StateHistoryEntry[] {
  const sorted = [...events].sort(
    (a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt),
  );
  // Anchor at creation: the order's first state is the from_status of the first
  // recorded transition (its status before any event), or the current status
  // when nothing has been recorded.
  const initialStatus = sorted[0]?.fromStatus ?? currentStatus;
  const points: { status: string; at: string; note: string | null }[] = [
    { status: initialStatus, at: createdAt, note: null },
    ...sorted.map((e) => ({ status: e.toStatus, at: e.occurredAt, note: e.note })),
  ];
  return points.map((p, i) => {
    const next = points[i + 1];
    const endMs = next ? Date.parse(next.at) : nowMs;
    return {
      status: p.status,
      label: humanizeStatus(p.status),
      tone: stateTone(p.status),
      enteredAt: p.at,
      durationMs: Math.max(0, endMs - Date.parse(p.at)),
      note: p.note,
      isCurrent: i === points.length - 1,
    };
  });
}

/** Shape the embedded detail read into the presentational `AdminOrderDetail`. */
export function shapeOrderDetail(
  raw: RawAdminOrderDetail,
  nowMs: number,
): AdminOrderDetail {
  const events: OrderStateEvent[] = (raw.order_state_events ?? []).map((e) => ({
    id: e.id,
    fromStatus: e.from_status,
    toStatus: e.to_status,
    occurredAt: e.occurred_at,
    note: e.note,
  }));

  const rawIntake = raw.intake_data?.[0] ?? null;
  const intake: IntakeSummary | null = rawIntake
    ? {
        existingSiteUrl: rawIntake.existing_site_url,
        hasScrapeResult: rawIntake.scrape_result_json != null,
        uploadedDocCount: rawIntake.uploaded_doc_paths?.length ?? 0,
        hasStructuredIntake: rawIntake.structured_intake_json != null,
      }
    : null;

  const content: ContentPiece[] = (raw.generated_content ?? [])
    .map((c) => ({
      id: c.id,
      version: c.version,
      page: c.page,
      section: c.section,
      confidenceScore: c.confidence_score,
      complianceVersionUsed: c.compliance_version_used,
      generatedAt: c.generated_at,
      approved: c.approved_at != null,
    }))
    // Newest version first, then by page for a stable read.
    .sort((a, b) => b.version - a.version || a.page.localeCompare(b.page));

  const violations: ViolationSummary[] = (raw.compliance_violations ?? []).map(
    (v) => ({
      id: v.id,
      severity: v.severity,
      fieldPath: v.field_path,
      description: v.violation_description,
      rulesetVersion: v.ruleset_version,
      resolved: v.resolved_at != null,
      resolutionAction: v.resolution_action,
    }),
  );

  const deployments: DeploymentLog[] = (raw.accounts?.sites ?? [])
    .flatMap((s) => s.deployments ?? [])
    .map((d) => ({
      id: d.id,
      status: d.status,
      contentVersion: d.content_version,
      triggeredBy: d.triggered_by,
      compliancePassed: d.compliance_check_passed,
      vercelDeploymentId: d.vercel_deployment_id,
      deployedAt: d.deployed_at,
    }))
    // Most-recent deploy first; nulls (queued/unknown) sort last.
    .sort(
      (a, b) =>
        (b.deployedAt ? Date.parse(b.deployedAt) : 0) -
        (a.deployedAt ? Date.parse(a.deployedAt) : 0),
    );

  return {
    id: raw.id,
    status: raw.status,
    stateLabel: humanizeStatus(raw.status),
    tone: stateTone(raw.status),
    group: stateGroup(raw.status),
    firmName: raw.accounts?.firm_name ?? null,
    email: raw.accounts?.users?.email ?? null,
    createdAt: raw.created_at,
    completedAt: raw.completed_at,
    retryCount: raw.retry_count,
    failureReason: raw.failure_reason,
    retriable: isFailureState(raw.status as OrderState),
    alert: pickActionableAlert(raw.admin_alerts ?? []),
    history: buildStateHistory(raw.created_at, events, raw.status, nowMs),
    intake,
    content,
    violations,
    deployments,
  };
}

// ---- IO ------------------------------------------------------------------

const ORDER_SELECT =
  "id, status, failure_reason, retry_count, created_at, completed_at, " +
  "accounts ( firm_name, users ( email ) ), " +
  "admin_alerts ( id, type, payload_json, created_at, resolved_at ), " +
  "order_state_events ( occurred_at )";

/** Read + shape the full order queue (service-role; bypasses RLS by design). */
export async function listAdminOrders(
  filters: AdminOrderFilters = {},
): Promise<AdminOrder[]> {
  const client = createAdminClient();
  const { data, error } = await client
    .from("orders")
    .select(ORDER_SELECT)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return shapeAdminOrders((data ?? []) as unknown as RawAdminOrderRow[], filters, Date.now());
}

const DETAIL_SELECT =
  "id, status, failure_reason, retry_count, created_at, completed_at, " +
  "accounts ( firm_name, users ( email ), sites ( deployments ( " +
  "id, status, content_version, triggered_by, compliance_check_passed, " +
  "vercel_deployment_id, deployed_at ) ) ), " +
  "intake_data ( existing_site_url, scrape_result_json, uploaded_doc_paths, structured_intake_json ), " +
  "generated_content ( id, version, page, section, confidence_score, compliance_version_used, generated_at, approved_at ), " +
  "compliance_violations ( id, severity, field_path, violation_description, ruleset_version, resolved_at, resolution_action ), " +
  "order_state_events ( id, from_status, to_status, occurred_at, note ), " +
  "admin_alerts ( id, type, payload_json, created_at, resolved_at )";

/**
 * Read + shape one order's full detail (service-role; RLS-bypassing by design).
 * One embedded query pulls the order, its firm + owner email, the account's
 * site → deployment logs, intake, generated-content versions, compliance
 * violations, and the state-machine history. Returns null for an unknown id.
 */
export async function getAdminOrderDetail(
  orderId: string,
): Promise<AdminOrderDetail | null> {
  const client = createAdminClient();
  const { data, error } = await client
    .from("orders")
    .select(DETAIL_SELECT)
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return shapeOrderDetail(data as unknown as RawAdminOrderDetail, Date.now());
}

// ---- recovery actions ----------------------------------------------------

/** Minimal sender contract — satisfied by the real Inngest client (`inngest.send`). */
export type OrderEventSender = {
  send(event: {
    name: "order.created";
    data: { orderId: string; accountId: string };
  }): Promise<unknown>;
};

export type OrderActionDeps = {
  client: AdminClient;
  send: OrderEventSender["send"];
};

/** Resolve every open `order_failed` alert for an order (no re-run). */
async function resolveOrderAlerts(client: AdminClient, orderId: string): Promise<void> {
  const { error } = await client
    .from("admin_alerts")
    .update({ resolved_at: new Date().toISOString() })
    .eq("order_id", orderId)
    .eq("type", "order_failed")
    .is("resolved_at", null);
  if (error) {
    throw new AppError("Failed to update the alert.", "alert_update_failed", 500);
  }
}

/**
 * One-click retry (§13.2): reset a failed order to the pipeline entry state,
 * bump its retry count, resolve its open alert, and re-enqueue `order.created`.
 *
 * v1 re-runs the pipeline from the top because 009's steps are still stubs — a
 * forward-only `transitionOrder` can't exit a terminal failure state, so this
 * is a deliberate admin reset (service-role) rather than a normal transition.
 * TODO(012–025): once steps are real + idempotent, resume from the failed step
 * instead of restarting (use `alert.step`).
 */
export async function retryOrder(
  { client, send }: OrderActionDeps,
  orderId: string,
): Promise<{ status: OrderState; retryCount: number }> {
  const { data, error } = await client
    .from("orders")
    .select("status, account_id, retry_count")
    .eq("id", orderId)
    .single();

  if (error || !data) {
    throw new AppError("Order not found.", "order_not_found", 404);
  }
  if (!isFailureState(data.status as OrderState)) {
    throw new AppError(
      "Only a failed order can be retried.",
      "not_retriable",
      409,
    );
  }

  const retryCount = (data.retry_count ?? 0) + 1;
  const { error: updateError } = await client
    .from("orders")
    .update({
      status: "payment_received",
      state_machine_position: "0",
      failure_reason: null,
      retry_count: retryCount,
    })
    .eq("id", orderId);
  if (updateError) {
    throw new AppError("Failed to reset the order.", "order_reset_failed", 500);
  }

  // Record the manual reset in the state-machine history so the detail view's
  // timeline shows the admin retry (this reset bypasses the forward-only
  // transitionOrder, so it logs its own event). Best-effort, like all history.
  await recordStateEvent(
    client,
    orderId,
    data.status as OrderState,
    "payment_received",
    "admin retry",
  );
  await resolveOrderAlerts(client, orderId);
  await send({
    name: "order.created",
    data: { orderId, accountId: data.account_id },
  });

  return { status: "payment_received", retryCount };
}

/** Dismiss the order's open alert(s) without re-running the build. */
export async function dismissAlert(
  { client }: OrderActionDeps,
  orderId: string,
): Promise<void> {
  await resolveOrderAlerts(client, orderId);
}

// ---- IO entry points (wired with the real client + Inngest sender) -------

export function retryOrderById(orderId: string) {
  return retryOrder(
    { client: createAdminClient(), send: (event) => inngest.send(event) },
    orderId,
  );
}

export function dismissOrderAlert(orderId: string) {
  return dismissAlert(
    { client: createAdminClient(), send: (event) => inngest.send(event) },
    orderId,
  );
}
