"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * §7.6 error state for the order queue. Admin UI can be lower-fidelity (§7.10)
 * but never broken — a failed read shows a human message + a retry, not a blank
 * screen. `reset()` re-runs the server component.
 */
export default function AdminOrdersError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Card className="flex flex-col items-center gap-4 p-10 text-center">
      <span className="bg-destructive/12 flex size-11 items-center justify-center rounded-2xl">
        <AlertTriangle className="text-destructive size-5" aria-hidden />
      </span>
      <div>
        <h2 className="text-base font-semibold">Couldn&apos;t load the order queue</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          The orders read failed. This is usually transient — try again.
        </p>
      </div>
      <Button onClick={reset}>Try again</Button>
    </Card>
  );
}
