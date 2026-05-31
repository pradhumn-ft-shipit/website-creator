import { describe, expect, it, vi } from "vitest";

import { AppError } from "./api/envelope";
import { getDbHealth, type CountableClient } from "./health";
import { PUBLIC_TABLES } from "@/types/database.types";

/** Build a CountableClient whose head-count select returns per-table counts. */
function clientWithCounts(counts: Partial<Record<string, number>>): CountableClient {
  return {
    from(table) {
      return {
        select: vi.fn(async () => ({ count: counts[table] ?? 0, error: null })),
      };
    },
  };
}

describe("getDbHealth", () => {
  it("returns a count for every public table plus the total", async () => {
    const client = clientWithCounts({ users: 1, accounts: 1, orders: 1 });

    const result = await getDbHealth(client);

    // every §10.1 table is represented
    expect(Object.keys(result.tables).sort()).toEqual([...PUBLIC_TABLES].sort());
    expect(result.tables.users).toBe(1);
    expect(result.tables.accounts).toBe(1);
    expect(result.tables.orders).toBe(1);
    expect(result.tables.waitlist).toBe(0);
    // seed chain (user→account→order) = 3 rows, rest empty
    expect(result.total).toBe(3);
  });

  it("treats a null count as zero", async () => {
    const client: CountableClient = {
      from: () => ({ select: vi.fn(async () => ({ count: null, error: null })) }),
    };

    const result = await getDbHealth(client);

    expect(result.total).toBe(0);
    expect(result.tables.users).toBe(0);
  });

  it("raises a 503 AppError when a table query fails (e.g. missing table)", async () => {
    const client: CountableClient = {
      from: () => ({
        select: vi.fn(async () => ({
          count: null,
          error: { message: 'relation "public.users" does not exist' },
        })),
      }),
    };

    await expect(getDbHealth(client)).rejects.toMatchObject({
      code: "db_health_query_failed",
      status: 503,
    });
    await expect(getDbHealth(client)).rejects.toBeInstanceOf(AppError);
  });
});
