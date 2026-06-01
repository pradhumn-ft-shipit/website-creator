"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Dashboard error boundary (§7.6 error state): human-readable message + a
 * recovery action, never a raw stack trace. Catches throws from any tab's
 * server data load (e.g. a transient DB error in Site Overview).
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-20 text-center">
      <span className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-2xl">
        <AlertTriangle className="size-5" aria-hidden />
      </span>
      <h2 className="mt-5 text-base font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground mt-2 max-w-sm text-sm">
        We couldn&apos;t load this section just now. This is usually temporary —
        try again, and if it keeps happening, contact support.
      </p>
      <Button onClick={() => reset()} className="mt-6">
        <RotateCw aria-hidden />
        Try again
      </Button>
    </div>
  );
}
