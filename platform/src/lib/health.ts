/**
 * Source of truth for the platform liveness probe. Shared by the
 * `GET /api/health` route (served as the {data,error} envelope) and the
 * `/health` page (rendered server-side). Kept trivial in v1 — extend with real
 * dependency checks (DB, queue) as the platform grows.
 */
import { AppError } from "@/lib/api/envelope";
import { PUBLIC_TABLES, type PublicTable } from "@/types/database.types";

export type HealthPayload = { status: "ok" };

export function getHealthStatus(): HealthPayload {
  return { status: "ok" };
}

/** Per-table row counts plus a total — the DB round-trip proof (ticket 002). */
export type DbHealthPayload = {
  tables: Record<PublicTable, number>;
  total: number;
};

/** The shape we need from a Supabase client: a head-count select per table.
 *  Narrowed to an interface so the count logic is unit-testable without a DB. */
export type CountableClient = {
  from(table: PublicTable): {
    select(
      columns: string,
      options: { count: "exact"; head: true },
    ): Promise<{ count: number | null; error: { message: string } | null }>;
  };
};

/**
 * Count rows in every public table via head-only `count: exact` queries (no
 * row data transferred). Proves the schema exists and round-trips. Runs with a
 * service-role client so RLS doesn't mask cross-account counts. Any table error
 * (e.g. a missing table) surfaces as an AppError rather than a silent zero.
 */
export async function getDbHealth(client: CountableClient): Promise<DbHealthPayload> {
  const counts = await Promise.all(
    PUBLIC_TABLES.map(async (table) => {
      const { count, error } = await client
        .from(table)
        .select("*", { count: "exact", head: true });
      if (error) {
        throw new AppError(
          `Failed to count table "${table}": ${error.message}`,
          "db_health_query_failed",
          503,
        );
      }
      return [table, count ?? 0] as const;
    }),
  );

  const tables = Object.fromEntries(counts) as Record<PublicTable, number>;
  const total = counts.reduce((sum, [, n]) => sum + n, 0);
  return { tables, total };
}
