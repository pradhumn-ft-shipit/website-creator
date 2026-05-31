"use client";

import { useCallback, useState } from "react";
import { Activity, CheckCircle2, RefreshCw, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ApiEnvelope } from "@/lib/api/envelope";

type HealthState =
  | { kind: "loading" }
  | { kind: "ok"; status: string }
  | { kind: "error"; message: string };

/**
 * Renders platform health. The initial value is fetched server-side and passed
 * in (no loading flash, no fetch-on-mount). "Re-check" calls `GET /api/health`
 * over real HTTP from the browser — the live proof of the {data,error} envelope.
 */
export function HealthStatus({ initialStatus }: { initialStatus: string }) {
  const [state, setState] = useState<HealthState>({
    kind: "ok",
    status: initialStatus,
  });

  const check = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const body: ApiEnvelope<{ status: string }> = await res.json();
      if (body.error) {
        setState({ kind: "error", message: body.error.message });
      } else {
        setState({ kind: "ok", status: body.data.status });
      }
    } catch {
      setState({ kind: "error", message: "Could not reach the API." });
    }
  }, []);

  return (
    <div className="bg-card rounded-xl border p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="bg-accent text-accent-foreground flex size-9 items-center justify-center rounded-lg">
            <Activity className="size-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-medium">API health</p>
            <p className="text-muted-foreground text-xs">GET /api/health</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void check()}
          disabled={state.kind === "loading"}
        >
          <RefreshCw className={state.kind === "loading" ? "animate-spin" : ""} />
          Re-check
        </Button>
      </div>

      <div
        className="mt-5 flex items-center gap-2 text-sm"
        role="status"
        aria-live="polite"
        data-testid="health-result"
      >
        {state.kind === "loading" && (
          <span className="text-muted-foreground">Checking…</span>
        )}
        {state.kind === "ok" && (
          <span className="text-success flex items-center gap-2 font-medium">
            <CheckCircle2 className="size-4" aria-hidden />
            status: {state.status}
          </span>
        )}
        {state.kind === "error" && (
          <span className="text-destructive flex items-center gap-2 font-medium">
            <XCircle className="size-4" aria-hidden />
            {state.message}
          </span>
        )}
      </div>
    </div>
  );
}
