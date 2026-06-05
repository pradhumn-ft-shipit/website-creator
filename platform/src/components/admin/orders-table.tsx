"use client";

import Link from "next/link";
import { Inbox } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { OrderActions } from "@/components/admin/order-actions";
import {
  formatDuration,
  type AdminOrder,
  type AdminOrderFilters,
  type StateTone,
} from "@/lib/admin/orders";

const TONE_VARIANT: Record<StateTone, "neutral" | "warning" | "success" | "destructive"> = {
  neutral: "neutral",
  info: "neutral",
  warning: "warning",
  success: "success",
  danger: "destructive",
};

const GROUP_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All orders" },
  { value: "attention", label: "Needs attention" },
  { value: "failed", label: "Failed" },
  { value: "needs_review", label: "Needs review" },
  { value: "in_progress", label: "In progress" },
  { value: "complete", label: "Complete" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
}

function FilterBar({ filters }: { filters: AdminOrderFilters }) {
  const hasFilters = Boolean(
    (filters.group && filters.group !== "all") ||
      filters.account ||
      filters.from ||
      filters.to,
  );
  return (
    // Native GET form → serializes into the query string and re-runs the server
    // read. No client state needed for filtering.
    <form
      action="/admin/orders"
      className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4 shadow-card"
    >
      <label className="flex flex-col gap-1 text-xs font-medium">
        State
        <select
          name="group"
          defaultValue={filters.group ?? "all"}
          className="border-input h-9 rounded-lg border bg-transparent px-3 text-sm"
        >
          {GROUP_OPTIONS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Account
        <input
          name="account"
          defaultValue={filters.account ?? ""}
          placeholder="Firm or email"
          className="border-input h-9 rounded-lg border bg-transparent px-3 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        From
        <input
          type="date"
          name="from"
          defaultValue={filters.from ?? ""}
          className="border-input h-9 rounded-lg border bg-transparent px-3 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        To
        <input
          type="date"
          name="to"
          defaultValue={filters.to ?? ""}
          className="border-input h-9 rounded-lg border bg-transparent px-3 text-sm"
        />
      </label>
      <Button type="submit" size="sm">
        Filter
      </Button>
      {hasFilters ? (
        <Button asChild size="sm" variant="ghost">
          <Link href="/admin/orders">Clear</Link>
        </Button>
      ) : null}
    </form>
  );
}

/**
 * The §11.1 order queue table. Dense + sortable-ready (newest-first from the
 * server), color-coded state, and per-row recovery actions with a confirm step.
 * Pure presentational over the shaped `AdminOrder[]`; filtering happens in the
 * URL (FilterBar) and the data layer.
 */
export function AdminOrdersTable({
  orders,
  filters,
}: {
  orders: AdminOrder[];
  filters: AdminOrderFilters;
}) {
  return (
    <div className="flex flex-col gap-4">
      <FilterBar filters={filters} />

      {orders.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <span className="bg-muted flex size-11 items-center justify-center rounded-2xl">
            <Inbox className="text-muted-foreground size-5" aria-hidden />
          </span>
          <p className="text-sm font-medium">No orders match these filters</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            New builds appear here the moment an order is created. Adjust the
            filters above to widen the view.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Order queue</caption>
              <thead className="bg-muted/50 text-muted-foreground text-xs">
                <tr className="text-left">
                  <th scope="col" className="px-4 py-3 font-medium">Order</th>
                  <th scope="col" className="px-4 py-3 font-medium">Account</th>
                  <th scope="col" className="px-4 py-3 font-medium">Created</th>
                  <th scope="col" className="px-4 py-3 font-medium">In state</th>
                  <th scope="col" className="px-4 py-3 font-medium">State</th>
                  <th scope="col" className="px-4 py-3 font-medium">Last failure</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((o) => (
                  <tr key={o.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="hover:text-primary focus-visible:ring-ring rounded font-mono text-xs underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                        title={`View order ${o.id}`}
                      >
                        {o.id.slice(0, 8)}
                      </Link>
                      {o.retryCount > 0 ? (
                        <span className="text-muted-foreground ml-2 text-xs">
                          ↻{o.retryCount}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{o.firmName ?? "—"}</div>
                      <div className="text-muted-foreground text-xs">{o.email ?? "—"}</div>
                    </td>
                    <td className="text-muted-foreground px-4 py-3 whitespace-nowrap">
                      {formatDate(o.createdAt)}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 whitespace-nowrap">
                      {formatDuration(o.timeInStateMs)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={TONE_VARIANT[o.tone]}>{o.stateLabel}</Badge>
                    </td>
                    <td className="text-muted-foreground max-w-xs px-4 py-3">
                      <span className="line-clamp-2">{o.lastFailureReason ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <OrderActions
                          orderId={o.id}
                          retriable={o.retriable}
                          hasAlert={Boolean(o.alert)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
