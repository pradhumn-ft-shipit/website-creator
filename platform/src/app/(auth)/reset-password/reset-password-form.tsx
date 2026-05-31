"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { Field } from "@/components/auth/field";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/api/client";
import { validateEmail } from "@/lib/auth/validation";

export function ResetPasswordForm() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const emailError = validateEmail(email);
    if (emailError) {
      setFieldError(emailError);
      return;
    }
    setFieldError(null);

    setSubmitting(true);
    const { error } = await postJson("/api/auth/reset-password", { email });
    setSubmitting(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    // Neutral confirmation — never reveals whether the address has an account.
    return (
      <div className="space-y-6">
        <header className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">
            Check your email
          </h1>
        </header>
        <FormMessage tone="success">
          If an account exists for that email, we&apos;ve sent a link to reset
          your password.
        </FormMessage>
        <Link
          href="/login"
          className="text-foreground inline-block text-sm font-medium underline underline-offset-2"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">
          Reset your password
        </h1>
        <p className="text-muted-foreground text-sm">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </header>

      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setFieldError(validateEmail(email))}
          error={fieldError}
          required
        />
        <Button type="submit" className="h-11 w-full" disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {submitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>

      <p className="text-muted-foreground text-center text-sm">
        <Link
          href="/login"
          className="text-foreground font-medium underline underline-offset-2"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
