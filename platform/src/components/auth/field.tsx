import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * A labeled text input with inline, accessible error reporting (§7.6 form
 * validation). When `error` is set, the input is marked `aria-invalid` and
 * described by the error node, which is announced via `role="alert"`.
 */
export function Field({
  id,
  label,
  error,
  ...inputProps
}: {
  id: string;
  label: string;
  error?: string | null;
} & React.ComponentProps<"input">) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
