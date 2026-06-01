import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Shared surface primitive (00A design system). The warm card sits above the
 * stone background on a soft, warm-tinted shadow (`shadow-card`) with a generous
 * radius — the core of the Mercury/Ramp feel. Replaces the hand-rolled
 * `bg-card rounded-xl border shadow-sm` that Settings and Site Overview each
 * duplicated. `tone="danger"` tints the border for destructive sections.
 */
function Card({
  className,
  tone = "default",
  ...props
}: React.ComponentProps<"div"> & { tone?: "default" | "danger" }) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground rounded-2xl border shadow-card",
        tone === "danger" && "border-destructive/35",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 p-6 pb-0", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn("text-lg leading-none font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p className={cn("text-muted-foreground text-sm", className)} {...props} />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-6", className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent };
