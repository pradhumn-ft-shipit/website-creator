import { describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/api/envelope";
import {
  createOrder,
  getOnboardingState,
  saveOnboardingSelection,
} from "./service";

type AccountRow = {
  id: string;
  industry: string | null;
  sub_industry: string | null;
};

type Recorder = {
  accountUpdate?: Record<string, unknown>;
  orderInsert?: Record<string, unknown>;
};

/**
 * Minimal Supabase stub: an `accounts` row keyed to the signed-in user and a
 * list of existing `orders` for that account. Records the account update and
 * order insert so tests can assert the write shapes.
 */
function makeClient(opts: {
  account: AccountRow | null;
  orders?: { id: string; status: string }[];
}) {
  const rec: Recorder = {};
  const orders = opts.orders ?? [];

  const client = {
    from(table: string) {
      if (table === "accounts") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: opts.account,
                error: null,
              }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            rec.accountUpdate = payload;
            return {
              eq: async () => ({ data: null, error: null }),
            };
          },
        };
      }
      // orders
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: async () => ({ data: orders, error: null }),
            }),
          }),
        }),
        insert: (payload: Record<string, unknown>) => {
          rec.orderInsert = payload;
          return {
            select: () => ({
              single: async () => ({
                data: { id: "order-new" },
                error: null,
              }),
            }),
          };
        },
      };
    },
  };

  return { client, rec };
}

const ACCT: AccountRow = { id: "acct-1", industry: null, sub_industry: null };

describe("saveOnboardingSelection", () => {
  it("persists a live industry choice to the account", async () => {
    const { client, rec } = makeClient({ account: ACCT });
    await saveOnboardingSelection(
      { client: client as never, userId: "user-1" },
      { industry: "ria" },
    );
    expect(rec.accountUpdate).toMatchObject({ industry: "ria" });
  });

  it("rejects a non-live industry (those route to the waitlist, never here)", async () => {
    const { client } = makeClient({ account: ACCT });
    await expect(
      saveOnboardingSelection(
        { client: client as never, userId: "user-1" },
        { industry: "insurance" },
      ),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("persists the sub-class confirmation", async () => {
    const { client, rec } = makeClient({ account: ACCT });
    await saveOnboardingSelection(
      { client: client as never, userId: "user-1" },
      { subIndustry: "ria_only" },
    );
    expect(rec.accountUpdate).toMatchObject({ sub_industry: "ria_only" });
  });

  it("rejects an out-of-scope sub-class", async () => {
    const { client } = makeClient({ account: ACCT });
    await expect(
      saveOnboardingSelection(
        { client: client as never, userId: "user-1" },
        { subIndustry: "bd_affiliated" },
      ),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe("createOrder", () => {
  it("creates a payment_received order WITHOUT emitting order.created (build moved to end of intake)", async () => {
    const { client, rec } = makeClient({
      account: { id: "acct-1", industry: "ria", sub_industry: "ria_only" },
      orders: [],
    });
    const send = vi.fn(async () => undefined);

    const result = await createOrder({
      client: client as never,
      userId: "user-1",
      send,
    });

    expect(rec.orderInsert).toMatchObject({
      account_id: "acct-1",
      status: "payment_received",
    });
    // 013 flow decision: the pipeline enqueue no longer fires at checkout.
    expect(send).not.toHaveBeenCalled();
    expect(result).toEqual({ orderId: "order-new", created: true });
  });

  it("is idempotent on double-submit: returns the existing order, no second insert", async () => {
    const { client, rec } = makeClient({
      account: { id: "acct-1", industry: "ria", sub_industry: "ria_only" },
      orders: [{ id: "order-existing", status: "scraping" }],
    });

    const result = await createOrder({ client: client as never, userId: "user-1" });

    expect(result).toEqual({ orderId: "order-existing", created: false });
    expect(rec.orderInsert).toBeUndefined();
  });

  it("refuses to create an order before industry + sub-class are chosen", async () => {
    const { client } = makeClient({
      account: { id: "acct-1", industry: "ria", sub_industry: null },
    });
    await expect(
      createOrder({ client: client as never, userId: "user-1" }),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe("getOnboardingState", () => {
  it("reports the resume signals: chosen fields + whether an order exists", async () => {
    const { client } = makeClient({
      account: { id: "acct-1", industry: "ria", sub_industry: "ria_only" },
      orders: [{ id: "order-1", status: "scraping" }],
    });
    const state = await getOnboardingState({
      client: client as never,
      userId: "user-1",
    });
    expect(state).toMatchObject({
      industry: "ria",
      subIndustry: "ria_only",
      hasOrder: true,
      orderId: "order-1",
    });
  });

  it("reports a fresh account with nothing chosen and no order", async () => {
    const { client } = makeClient({ account: ACCT, orders: [] });
    const state = await getOnboardingState({
      client: client as never,
      userId: "user-1",
    });
    expect(state).toMatchObject({
      industry: null,
      subIndustry: null,
      hasOrder: false,
    });
  });
});
