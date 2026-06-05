import {
  listAdminOrders,
  type AdminOrderFilters,
  type StateGroup,
} from "@/lib/admin/orders";
import { AdminOrdersTable } from "@/components/admin/orders-table";

/** The order queue is always live — never statically cached. */
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const GROUPS = new Set<AdminOrderFilters["group"]>([
  "all",
  "attention",
  "failed",
  "needs_review",
  "in_progress",
  "complete",
]);

function one(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  const trimmed = v?.trim();
  return trimmed ? trimmed : undefined;
}

function parseFilters(sp: SearchParams): AdminOrderFilters {
  const rawGroup = one(sp.group);
  const group =
    rawGroup && GROUPS.has(rawGroup as StateGroup | "all" | "attention")
      ? (rawGroup as AdminOrderFilters["group"])
      : undefined;
  return {
    group,
    account: one(sp.account),
    from: one(sp.from),
    to: one(sp.to),
  };
}

/**
 * `/admin/orders` — the build control room (PRD §11.1). Reads the full order
 * queue via the service-role data layer (RLS-bypassing by design), applying the
 * URL filters, then hands the shaped rows to the client table for color-coding,
 * filtering, and the Retry / Dismiss actions.
 */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = parseFilters(await searchParams);
  const orders = await listAdminOrders(filters);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Orders</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Every build and its current state. Failed orders surface a retry; the
          queue is driven by unresolved admin alerts.
        </p>
      </div>
      <AdminOrdersTable orders={orders} filters={filters} />
    </div>
  );
}
