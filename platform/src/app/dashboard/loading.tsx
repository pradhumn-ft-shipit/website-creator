/**
 * Tab-level loading skeleton for the dashboard segment (§7.6 loading state).
 * Shown while a tab's server data resolves.
 */
export default function DashboardLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="border-b pb-5">
        <div className="bg-muted h-6 w-40 animate-pulse rounded" />
        <div className="bg-muted/70 mt-2 h-4 w-72 animate-pulse rounded" />
      </div>
      <div className="bg-muted/60 h-28 animate-pulse rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-muted/60 h-28 animate-pulse rounded-2xl" />
        <div className="bg-muted/60 h-28 animate-pulse rounded-2xl" />
        <div className="bg-muted/60 h-28 animate-pulse rounded-2xl" />
      </div>
    </div>
  );
}
