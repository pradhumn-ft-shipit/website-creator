"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Field } from "@/components/auth/field";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/api/client";
import { MIN_PASSWORD_LENGTH, validatePassword } from "@/lib/auth/validation";

/**
 * Set a new password. Reached via the emailed recovery link, which routes
 * through /api/auth/callback and establishes a short-lived recovery session;
 * the POST below relies on that session (Supabase rejects it otherwise).
 */
export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const passwordError = validatePassword(password);
    if (passwordError) {
      setFieldError(passwordError);
      return;
    }
    setFieldError(null);

    setSubmitting(true);
    const { error } = await postJson("/api/auth/update-password", { password });
    if (error) {
      setSubmitting(false);
      setFormError(
        error.code === "internal_error"
          ? "This reset link has expired. Please request a new one."
          : error.message,
      );
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">
          Choose a new password
        </h1>
        <p className="text-muted-foreground text-sm">
          Enter a new password for your account.
        </p>
      </header>

      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field
          id="password"
          label="New password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setFieldError(validatePassword(password))}
          error={fieldError}
          aria-describedby="password-hint"
          required
        />
        {!fieldError ? (
          <p id="password-hint" className="text-muted-foreground -mt-2 text-xs">
            At least {MIN_PASSWORD_LENGTH} characters.
          </p>
        ) : null}

        <Button type="submit" className="h-11 w-full" disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {submitting ? "Saving…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}
