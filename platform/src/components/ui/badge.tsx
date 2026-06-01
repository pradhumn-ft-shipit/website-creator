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
        // the brand/semantic tokens are too light to use as text on a light
        // wash. Fixed-oklch text (v1 is light-only); re-derived for the 00A
        // warm-stone + emerald palette.
        default: "border-transparent bg-primary/12 text-[oklch(0.4_0.088_166)]",
        neutral: "border-transparent bg-muted text-foreground/70",
        success: "border-transparent bg-success/15 text-[oklch(0.4_0.1_150)]",
        warning: "border-transparent bg-warning/22 text-[oklch(0.44_0.095_68)]",
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
