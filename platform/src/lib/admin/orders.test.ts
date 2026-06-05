import { describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/api/envelope";
import {
  buildStateHistory,
  dismissAlert,
  formatDuration,
  getAdminOrderDetail,
  humanizeStatus,
  retryOrder,
  shapeAdminOrders,
  shapeOrderDetail,
  stateGroup,
  stateTone,
  type OrderStateEvent,
  type RawAdminOrderDetail,
  type RawAdminOrderRow,
} from "./orders";

const NOW = Date.UTC(2026, 5, 1, 12, 0, 0); // 2026-06-01T12:00:00Z

function row(over: Partial<RawAdminOrderRow> = {}): RawAdminOrderRow {
  return {
    id: "order-1",
    status: "building",
    failure_reason: null,
    retry_count: 0,
    created_at: "2026-06-01T10:00:00Z",
    completed_at: null,
    accounts: { firm_name: "Cedar Ridge Wealth", users: { email: "jane@cedar.com" } },
    admin_alerts: [],
    ...over,
  };
}

describe("state classification", () => {
  it("maps failure states to the danger tone + failed group", () => {
    for (const s of ["generation_failed", "build_failed", "deploy_failed", "validation_failed", "scrape_failed"]) {
      expect(stateTone(s)).toBe("danger");
      expect(stateGroup(s)).toBe("failed");
    }
  });

  it("maps review states to warning + needs_review", () => {
    for (const s of ["copy_review", "compliance_review_layer2", "compliance_review_layer3", "admin_review_required"]) {
      expect(stateTone(s)).toBe("warning");
      expect(stateGroup(s)).toBe("needs_review");
    }
  });

  it("maps terminal-good states to success + complete", () => {
    expect(stateGroup("live")).toBe("complete");
    expect(stateTone("live")).toBe("success");
    expect(stateGroup("dns_monitoring")).toBe("complete");
  });

  it("treats everything else as in-progress", () => {
    expect(stateGroup("scraping")).toBe("in_progress");
    expect(stateTone("scraping")).toBe("info");
  });

  it("humanizes the status token for display", () => {
    expect(humanizeStatus("generation_failed")).toBe("Generation failed");
    expect(humanizeStatus("compliance_review_layer2")).toBe("Compliance review layer2");
  });
});

describe("formatDuration", () => {
  it("renders compact human durations", () => {
    expect(formatDuration(30 * 1000)).toBe("just now");
    expect(formatDuration(5 * 60 * 1000)).toBe("5m");
    expect(formatDuration(3 * 60 * 60 * 1000 + 12 * 60 * 1000)).toBe("3h 12m");
    expect(formatDuration(2 * 24 * 60 * 60 * 1000)).toBe("2d");
  });
});

describe("shapeAdminOrders", () => {
  it("shapes a healthy in-progress order with account identity", () => {
    const [o] = shapeAdminOrders([row()], {}, NOW);
    expect(o).toMatchObject({
      id: "order-1",
      firmName: "Cedar Ridge Wealth",
      email: "jane@cedar.com",
      tone: "info",
      group: "in_progress",
      retriable: false,
      alert: null,
      lastFailureReason: null,
    });
    // time-in-state falls back to created_at when there's no failure alert (2h)
    expect(o.timeInStateMs).toBe(2 * 60 * 60 * 1000);
  });

  it("surfaces the unresolved order_failed alert + uses its message as the failure reason", () => {
    const [o] = shapeAdminOrders(
      [
        row({
          status: "build_failed",
          admin_alerts: [
            {
              id: "alert-1",
              type: "order_failed",
              payload_json: { step: "build", message: "astro build crashed" },
              created_at: "2026-06-01T11:30:00Z",
              resolved_at: null,
            },
          ],
        }),
      ],
      {},
      NOW,
    );
    expect(o.retriable).toBe(true);
    expect(o.alert?.id).toBe("alert-1");
    expect(o.alert?.step).toBe("build");
    expect(o.lastFailureReason).toBe("astro build crashed");
    // time-in-state measured from the failure alert (30m), not creation
    expect(o.timeInStateMs).toBe(30 * 60 * 1000);
  });

  it("prefers an explicit failure_reason column over the alert message", () => {
    const [o] = shapeAdminOrders(
      [
        row({
          status: "deploy_failed",
          failure_reason: "Vercel 502",
          admin_alerts: [
            { id: "a", type: "order_failed", payload_json: { message: "x" }, created_at: "2026-06-01T11:00:00Z", resolved_at: null },
          ],
        }),
      ],
      {},
      NOW,
    );
    expect(o.lastFailureReason).toBe("Vercel 502");
  });

  it("ignores resolved alerts and non-order_failed alerts when choosing the actionable one", () => {
    const [o] = shapeAdminOrders(
      [
        row({
          status: "build_failed",
          admin_alerts: [
            { id: "resolved", type: "order_failed", payload_json: {}, created_at: "2026-06-01T09:00:00Z", resolved_at: "2026-06-01T09:30:00Z" },
            { id: "other", type: "compliance_review", payload_json: {}, created_at: "2026-06-01T11:00:00Z", resolved_at: null },
          ],
        }),
      ],
      {},
      NOW,
    );
    expect(o.alert).toBeNull();
  });

  it("sorts newest-created first", () => {
    const out = shapeAdminOrders(
      [
        row({ id: "old", created_at: "2026-05-01T00:00:00Z" }),
        row({ id: "new", created_at: "2026-06-01T00:00:00Z" }),
      ],
      {},
      NOW,
    );
    expect(out.map((o) => o.id)).toEqual(["new", "old"]);
  });

  it("filters by group, account substring, attention, and date range", () => {
    const rows = [
      row({ id: "fail", status: "build_failed", created_at: "2026-06-01T00:00:00Z", admin_alerts: [{ id: "al", type: "order_failed", payload_json: {}, created_at: "2026-06-01T01:00:00Z", resolved_at: null }] }),
      row({ id: "live", status: "live", created_at: "2026-06-01T00:00:00Z", accounts: { firm_name: "Other Firm", users: { email: "bob@other.com" } } }),
      row({ id: "old", status: "live", created_at: "2026-01-01T00:00:00Z" }),
    ];
    expect(shapeAdminOrders(rows, { group: "failed" }, NOW).map((o) => o.id)).toEqual(["fail"]);
    expect(shapeAdminOrders(rows, { group: "attention" }, NOW).map((o) => o.id)).toEqual(["fail"]);
    expect(shapeAdminOrders(rows, { account: "other" }, NOW).map((o) => o.id)).toEqual(["live"]);
    expect(shapeAdminOrders(rows, { account: "bob@other" }, NOW).map((o) => o.id)).toEqual(["live"]);
    expect(shapeAdminOrders(rows, { from: "2026-05-01" }, NOW).map((o) => o.id).sort()).toEqual(["fail", "live"]);
  });
});

// ---- action mock client -------------------------------------------------

type Recorder = {
  orderUpdate?: Record<string, unknown>;
  alertUpdate?: Record<string, unknown>;
  stateEvent?: Record<string, unknown>;
};

function makeActionClient(order: { status: string; account_id: string; retry_count: number } | null) {
  const rec: Recorder = {};

  function thenable(result: { data: unknown; error: unknown }) {
    const builder: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is"]) builder[m] = () => builder;
    builder.single = async () => result;
    builder.then = (resolve: (v: unknown) => unknown) => resolve(result);
    return builder;
  }

  const client = {
    from(table: string) {
      if (table === "orders") {
        return {
          select: () => thenable({ data: order, error: order ? null : { message: "not found" } }),
          update: (payload: Record<string, unknown>) => {
            rec.orderUpdate = payload;
            return thenable({ data: null, error: null });
          },
        };
      }
      if (table === "order_state_events") {
        return {
          insert: async (payload: Record<string, unknown>) => {
            rec.stateEvent = payload;
            return { data: null, error: null };
          },
        };
      }
      // admin_alerts
      return {
        update: (payload: Record<string, unknown>) => {
          rec.alertUpdate = payload;
          return thenable({ data: null, error: null });
        },
      };
    },
  };

  return { client, rec };
}

describe("retryOrder", () => {
  it("resets a failed order, bumps retry_count, resolves its alert, and re-enqueues order.created", async () => {
    const { client, rec } = makeActionClient({ status: "build_failed", account_id: "acct-1", retry_count: 1 });
    const send = vi.fn(async () => undefined);

    const result = await retryOrder({ client: client as never, send }, "order-1");

    expect(rec.orderUpdate).toMatchObject({
      status: "payment_received",
      state_machine_position: "0",
      failure_reason: null,
      retry_count: 2,
    });
    expect(rec.alertUpdate).toHaveProperty("resolved_at");
    expect(send).toHaveBeenCalledWith({
      name: "order.created",
      data: { orderId: "order-1", accountId: "acct-1" },
    });
    expect(result.status).toBe("payment_received");
    expect(result.retryCount).toBe(2);
  });

  it("records an 'admin retry' state-history event for the reset", async () => {
    const { client, rec } = makeActionClient({ status: "build_failed", account_id: "acct-1", retry_count: 0 });
    const send = vi.fn(async () => undefined);

    await retryOrder({ client: client as never, send }, "order-1");

    expect(rec.stateEvent).toMatchObject({
      order_id: "order-1",
      from_status: "build_failed",
      to_status: "payment_received",
      note: "admin retry",
    });
  });

  it("rejects retry on an order that is not in a failed state (409)", async () => {
    const { client } = makeActionClient({ status: "building", account_id: "acct-1", retry_count: 0 });
    const send = vi.fn(async () => undefined);
    await expect(retryOrder({ client: client as never, send }, "order-1")).rejects.toMatchObject({
      code: "not_retriable",
      status: 409,
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("throws a 404 AppError when the order does not exist", async () => {
    const { client } = makeActionClient(null);
    const send = vi.fn(async () => undefined);
    await expect(retryOrder({ client: client as never, send }, "missing")).rejects.toBeInstanceOf(AppError);
  });
});

describe("dismissAlert", () => {
  it("resolves the order's open alerts without re-enqueuing the pipeline", async () => {
    const { client, rec } = makeActionClient({ status: "build_failed", account_id: "acct-1", retry_count: 0 });
    const send = vi.fn(async () => undefined);
    await dismissAlert({ client: client as never, send }, "order-1");
    expect(rec.alertUpdate).toHaveProperty("resolved_at");
    expect(send).not.toHaveBeenCalled();
  });
});

// ---- detail view --------------------------------------------------------

describe("time-in-state from the state-history events (queue upgrade)", () => {
  it("measures from the latest event when present (precise), not the alert/creation", () => {
    const [o] = shapeAdminOrders(
      [
        row({
          status: "building",
          created_at: "2026-06-01T08:00:00Z",
          // entered `building` at 11:00 → 1h ago at NOW (12:00)
          order_state_events: [
            { occurred_at: "2026-06-01T09:00:00Z" },
            { occurred_at: "2026-06-01T11:00:00Z" },
          ],
        }),
      ],
      {},
      NOW,
    );
    expect(o.timeInStateMs).toBe(60 * 60 * 1000);
  });

  it("falls back to the old measure when no events exist (backward-compatible)", () => {
    const [o] = shapeAdminOrders([row()], {}, NOW); // no events → created_at (2h)
    expect(o.timeInStateMs).toBe(2 * 60 * 60 * 1000);
  });
});

function ev(over: Partial<OrderStateEvent> = {}): OrderStateEvent {
  return {
    id: "e",
    fromStatus: null,
    toStatus: "scraping",
    occurredAt: "2026-06-01T10:30:00Z",
    note: null,
    ...over,
  };
}

describe("buildStateHistory", () => {
  it("anchors at creation in the first event's from_status, ordered, with durations", () => {
    const history = buildStateHistory(
      "2026-06-01T10:00:00Z",
      [
        ev({ id: "e2", fromStatus: "scraping", toStatus: "scrape_complete", occurredAt: "2026-06-01T11:00:00Z" }),
        ev({ id: "e1", fromStatus: "payment_received", toStatus: "scraping", occurredAt: "2026-06-01T10:30:00Z" }),
      ],
      "scrape_complete",
      NOW,
    );
    expect(history.map((h) => h.status)).toEqual([
      "payment_received",
      "scraping",
      "scrape_complete",
    ]);
    // payment_received: 10:00 → 10:30 = 30m
    expect(history[0].durationMs).toBe(30 * 60 * 1000);
    // scraping: 10:30 → 11:00 = 30m
    expect(history[1].durationMs).toBe(30 * 60 * 1000);
    // current state runs to NOW (11:00 → 12:00 = 1h)
    expect(history[2].isCurrent).toBe(true);
    expect(history[2].durationMs).toBe(60 * 60 * 1000);
    expect(history[2].tone).toBe("info");
  });

  it("returns a single current entry from creation when there are no events", () => {
    const history = buildStateHistory("2026-06-01T11:00:00Z", [], "payment_received", NOW);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ status: "payment_received", isCurrent: true });
    expect(history[0].durationMs).toBe(60 * 60 * 1000);
  });

  it("carries the note (e.g. 'admin retry') onto the entered state", () => {
    const history = buildStateHistory(
      "2026-06-01T10:00:00Z",
      [ev({ fromStatus: "build_failed", toStatus: "payment_received", note: "admin retry" })],
      "payment_received",
      NOW,
    );
    expect(history[1]).toMatchObject({ status: "payment_received", note: "admin retry" });
  });
});

function detailRow(over: Partial<RawAdminOrderDetail> = {}): RawAdminOrderDetail {
  return {
    id: "order-1",
    status: "deploy_failed",
    failure_reason: "Vercel 502",
    retry_count: 1,
    created_at: "2026-06-01T10:00:00Z",
    completed_at: null,
    accounts: {
      firm_name: "Cedar Ridge Wealth",
      users: { email: "jane@cedar.com" },
      sites: [
        {
          deployments: [
            { id: "d1", status: "error", content_version: 2, triggered_by: "system", compliance_check_passed: true, vercel_deployment_id: "dpl_2", deployed_at: "2026-06-01T11:30:00Z" },
            { id: "d0", status: "ready", content_version: 1, triggered_by: "system", compliance_check_passed: true, vercel_deployment_id: "dpl_1", deployed_at: "2026-06-01T10:45:00Z" },
          ],
        },
      ],
    },
    intake_data: [
      { existing_site_url: "https://old.example.com", scrape_result_json: { ok: true }, uploaded_doc_paths: ["a.pdf", "b.pdf"], structured_intake_json: null },
    ],
    generated_content: [
      { id: "c1", version: 1, page: "home", section: "hero", confidence_score: 0.91, compliance_version_used: "ria/v1.0", generated_at: "2026-06-01T10:50:00Z", approved_at: "2026-06-01T10:55:00Z" },
      { id: "c2", version: 2, page: "about", section: null, confidence_score: 0.8, compliance_version_used: "ria/v1.0", generated_at: "2026-06-01T11:10:00Z", approved_at: null },
    ],
    compliance_violations: [
      { id: "v1", severity: "high", field_path: "home.hero.headline", violation_description: "performance guarantee", ruleset_version: "ria/v1.0", resolved_at: null, resolution_action: null },
    ],
    order_state_events: [
      { id: "e1", from_status: "payment_received", to_status: "scraping", occurred_at: "2026-06-01T10:10:00Z", note: null },
      { id: "e2", from_status: "building", to_status: "deploying", occurred_at: "2026-06-01T11:20:00Z", note: null },
    ],
    admin_alerts: [
      { id: "al1", type: "order_failed", payload_json: { step: "deploy", message: "Vercel 502" }, created_at: "2026-06-01T11:35:00Z", resolved_at: null },
    ],
    ...over,
  };
}

describe("shapeOrderDetail", () => {
  it("shapes account identity, retriability, and the actionable alert", () => {
    const d = shapeOrderDetail(detailRow(), NOW);
    expect(d).toMatchObject({
      id: "order-1",
      firmName: "Cedar Ridge Wealth",
      email: "jane@cedar.com",
      tone: "danger",
      group: "failed",
      retriable: true,
      failureReason: "Vercel 502",
    });
    expect(d.alert?.step).toBe("deploy");
  });

  it("summarizes intake without dumping raw JSON", () => {
    const d = shapeOrderDetail(detailRow(), NOW);
    expect(d.intake).toEqual({
      existingSiteUrl: "https://old.example.com",
      hasScrapeResult: true,
      uploadedDocCount: 2,
      hasStructuredIntake: false,
    });
  });

  it("lists generated content newest-version-first with approval state", () => {
    const d = shapeOrderDetail(detailRow(), NOW);
    expect(d.content.map((c) => `${c.page}:${c.version}`)).toEqual(["about:2", "home:1"]);
    expect(d.content.find((c) => c.page === "home")?.approved).toBe(true);
    expect(d.content.find((c) => c.page === "about")?.approved).toBe(false);
  });

  it("flattens deployment logs across the account's site, newest deploy first", () => {
    const d = shapeOrderDetail(detailRow(), NOW);
    expect(d.deployments.map((x) => x.id)).toEqual(["d1", "d0"]);
    expect(d.deployments[0]).toMatchObject({ status: "error", contentVersion: 2, compliancePassed: true });
  });

  it("maps compliance violations with a resolved flag", () => {
    const d = shapeOrderDetail(detailRow(), NOW);
    expect(d.violations).toHaveLength(1);
    expect(d.violations[0]).toMatchObject({ severity: "high", fieldPath: "home.hero.headline", resolved: false });
  });

  it("builds the state history from the embedded events", () => {
    const d = shapeOrderDetail(detailRow(), NOW);
    expect(d.history[0].status).toBe("payment_received");
    expect(d.history.at(-1)?.isCurrent).toBe(true);
  });

  it("tolerates an order with no related rows (nulls everywhere)", () => {
    const d = shapeOrderDetail(
      detailRow({
        accounts: null,
        intake_data: null,
        generated_content: null,
        compliance_violations: null,
        order_state_events: null,
        admin_alerts: null,
        status: "scraping",
      }),
      NOW,
    );
    expect(d.intake).toBeNull();
    expect(d.content).toEqual([]);
    expect(d.violations).toEqual([]);
    expect(d.deployments).toEqual([]);
    expect(d.alert).toBeNull();
    // history still anchors at creation in the current state
    expect(d.history).toHaveLength(1);
    expect(d.history[0].status).toBe("scraping");
  });
});

describe("getAdminOrderDetail (IO)", () => {
  it("returns null for an unknown order id", async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        }),
      }),
    };
    const mod = await import("@/lib/supabase/admin");
    const spy = vi.spyOn(mod, "createAdminClient").mockReturnValue(client as never);
    await expect(getAdminOrderDetail("missing")).resolves.toBeNull();
    spy.mockRestore();
  });
});
