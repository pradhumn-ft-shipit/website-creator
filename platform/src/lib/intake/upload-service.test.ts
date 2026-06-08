import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/api/envelope";
import { uploadDocsForUser } from "./upload-service";

function bytes(n: number): Uint8Array {
  return new Uint8Array(n).fill(120);
}

/** RLS client double: returns the account/order the user "owns" (or none). */
function makeRls(account: { id: string } | null, order: { id: string } | null) {
  return {
    from(table: string) {
      if (table === "accounts") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: account, error: null }) }),
          }),
        };
      }
      if (table === "orders") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({ data: order ? [order] : [], error: null }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

/** Admin client double: accepts the storage write + intake upsert. */
function makeAdmin() {
  const upserts: Array<Record<string, unknown>> = [];
  const client = {
    storage: {
      from: () => ({ upload: async (path: string) => ({ data: { path }, error: null }) }),
    },
    from() {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        }),
        upsert: async (payload: Record<string, unknown>) => {
          upserts.push(payload);
          return { data: null, error: null };
        },
      };
    },
  };
  return { client, upserts };
}

describe("uploadDocsForUser", () => {
  it("resolves the advisor's order via RLS and stores the docs", async () => {
    const rls = makeRls({ id: "acct-1" }, { id: "order-1" });
    const { client: admin } = makeAdmin();

    const result = await uploadDocsForUser({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rls: rls as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      admin: admin as any,
      userId: "user-1",
      files: [{ filename: "brochure.pdf", bytes: bytes(50) }],
    });

    expect(result.orderId).toBe("order-1");
    expect(result.paths).toEqual(["order-1/brochure.pdf"]);
  });

  it("404s when the user has no account", async () => {
    const rls = makeRls(null, null);
    const { client: admin } = makeAdmin();
    await expect(
      uploadDocsForUser({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rls: rls as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        admin: admin as any,
        userId: "user-1",
        files: [{ filename: "a.pdf", bytes: bytes(50) }],
      }),
    ).rejects.toMatchObject({ code: "account_missing" });
  });

  it("409s when the account has no order yet", async () => {
    const rls = makeRls({ id: "acct-1" }, null);
    const { client: admin } = makeAdmin();
    await expect(
      uploadDocsForUser({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rls: rls as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        admin: admin as any,
        userId: "user-1",
        files: [{ filename: "a.pdf", bytes: bytes(50) }],
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
