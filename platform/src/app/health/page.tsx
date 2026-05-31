import type { Metadata } from "next";

import { getHealthStatus } from "@/lib/health";
import { HealthStatus } from "./health-status";

export const metadata: Metadata = {
  title: "Health — WRI",
};

export default function HealthPage() {
  const { status } = getHealthStatus();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">System health</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Live read of the platform API through the central{" "}
        <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
          {"{ data, error }"}
        </code>{" "}
        envelope.
      </p>
      <div className="mt-8">
        <HealthStatus initialStatus={status} />
      </div>
    </main>
  );
}
