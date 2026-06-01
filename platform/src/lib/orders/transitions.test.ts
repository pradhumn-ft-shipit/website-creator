import { describe, it, expect } from "vitest";

import { IllegalTransitionError } from "./state-machine";
import { transitionOrder, escalateOrderFailure } from "./transitions";

/**
 * Minimal Supabase-admin-client test double. Records the last update payload and
 * any insert into admin_alerts. Supports the chained `.from().update().eq()` and
 * `.from().select().eq().single()` shapes used by the IO layer.
 */
function makeClient(currentStatus: string) {
  const updates: Array<Record<string, unknown>> = [];
  const alerts: Array<Record<string, unknown>> = [];

  const client = {
    from(table: string) {
      if (table === "orders") {
        return {
          select() {
            return {
              eq() {
                return {
                  single: async () => ({
                    data: { status: currentStatus },
                    error: null,
                  }),
                };
              },
            };
          },
          update(payload: Record<string, unknown>) {
            updates.push(payload);
            return {
              eq: async () => ({ data: null, error: null }),
            };
          },
        };
      }
      if (table === "admin_alerts") {
        return {
          insert: async (payload: Record<string, unknown>) => {
            alerts.push(payload);
            return { data: null, error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };

  return { client, updates, alerts };
}

describe("transitionOrder", () => {
  it("persists status + state_machine_position on a legal transition", async () => {
    const { client, updates } = makeClient("payment_received");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await transitionOrder(client as any, "order-1", "scraping");

    expect(result).toBe("scraping");
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      status: "scraping",
      state_machine_position: "1",
    });
  });

  it("rejects an illegal transition and does not write", async () => {
    const { client, updates } = makeClient("payment_received");
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transitionOrder(client as any, "order-1", "live"),
    ).rejects.toBeInstanceOf(IllegalTransitionError);
    expect(updates).toHaveLength(0);
  });
});

describe("escalateOrderFailure", () => {
  it("writes an order_failed admin_alerts row with the error trace", async () => {
    const { client, alerts } = makeClient("building");
    await escalateOrderFailure(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
      "order-1",
      new Error("build blew up"),
      "build",
    );

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      type: "order_failed",
      order_id: "order-1",
    });
    const payload = (alerts[0] as { payload_json: Record<string, unknown> })
      .payload_json;
    expect(payload.step).toBe("build");
    expect(String(payload.message)).toContain("build blew up");
    expect(payload.trace).toBeDefined();
  });
});
