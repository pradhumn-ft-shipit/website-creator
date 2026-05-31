import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Plain native `<label>` (not Radix) — shadcn's Label wraps
 * @radix-ui/react-label, a dependency we don't carry. A native label covers
 * every auth form need (htmlFor association, click-to-focus) without one.
 */
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn("text-sm font-medium leading-none", className)}
      {...props}
    />
  );
}

export { Label };
