import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        // Tinted pills: background is a soft wash of the hue, text is a darker
        // shade of the SAME hue so each clears WCAG AA (4.5:1) on its tint —
        // the bright semantic tokens (success L0.62 / warning L0.75) are too
        // light to use as text on a light wash. Fixed oklch (v1 is light-only).
        default: "border-transparent bg-primary/10 text-[oklch(0.45_0.2_277)]",
        neutral: "border-transparent bg-muted text-foreground/70",
        success: "border-transparent bg-success/15 text-[oklch(0.43_0.14_145)]",
        warning: "border-transparent bg-warning/20 text-[oklch(0.46_0.1_75)]",
        outline: "text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
