import { AlertCircle, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Form-level banner for the result of a submit (§7.6 error/success states).
 * Errors use `role="alert"` (assertive), success uses `role="status"` (polite).
 */
export function FormMessage({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  const isError = tone === "error";
  const Icon = isError ? AlertCircle : CheckCircle2;
  return (
    <div
      role={isError ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm",
        isError
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-success/30 bg-success/5 text-success",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="[&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2">
        {children}
      </div>
    </div>
  );
}
