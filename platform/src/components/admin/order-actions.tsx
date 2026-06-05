"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/api/client";

/**
 * The two §13.2 recovery actions for one order — **Retry** (reset + re-run the
 * build) and **Dismiss** (resolve the open alert without re-running). Both go
 * through an inline two-step confirm (no modal dep — same pattern as 027's
 * danger-zone) and POST to `/api/admin/orders/:id/{retry,dismiss}`, then refresh
 * the server data on success. Shared by the order queue (table row) and the
 * order detail view, so the actions stay identical in both places.
 */
export function OrderActions({
  orderId,
  retriable,
  hasAlert,
  size = "sm",
}: {
  orderId: string;
  retriable: boolean;
  hasAlert: boolean;
  size?: "sm" | "default";
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<"retry" | "dismiss" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!retriable && !hasAlert) {
    return <span className="text-muted-foreground/60 text-xs">—</span>;
  }

  async function run(action: "retry" | "dismiss") {
    setPending(true);
    setError(null);
    const { error } = await postJson(`/api/admin/orders/${orderId}/${action}`, {});
    setPending(false);
    if (error) {
      setError(error.message);
      setConfirming(null);
      return;
    }
    setConfirming(null);
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs">
          {confirming === "retry" ? "Re-run build?" : "Dismiss alert?"}
        </span>
        <Button
          size={size}
          variant={confirming === "retry" ? "default" : "outline"}
          disabled={pending}
          onClick={() => void run(confirming)}
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Confirm
        </Button>
        <Button
          size={size}
          variant="ghost"
          disabled={pending}
          onClick={() => setConfirming(null)}
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {retriable ? (
        <Button size={size} variant="outline" onClick={() => setConfirming("retry")}>
          <RotateCw aria-hidden />
          Retry
        </Button>
      ) : null}
      {hasAlert ? (
        <Button
          size={size}
          variant="ghost"
          onClick={() => setConfirming("dismiss")}
          aria-label="Dismiss alert"
        >
          <Trash2 aria-hidden />
          Dismiss
        </Button>
      ) : null}
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
    </div>
  );
}
