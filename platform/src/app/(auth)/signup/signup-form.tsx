"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Field } from "@/components/auth/field";
import { FormMessage } from "@/components/auth/form-message";
import { GoogleButton } from "@/components/auth/google-button";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/api/client";
import {
  MIN_PASSWORD_LENGTH,
  validateEmail,
  validatePassword,
} from "@/lib/auth/validation";

type SignUpData = { status: "verification_sent" | "already_registered" };
type FieldErrors = { email?: string | null; password?: string | null };

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [existing, setExisting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setExisting(false);

    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    if (emailError || passwordError) {
      setErrors({ email: emailError, password: passwordError });
      return;
    }
    setErrors({});

    setSubmitting(true);
    const { data, error } = await postJson<SignUpData>("/api/auth/signup", {
      email,
      password,
    });
    if (error) {
      setSubmitting(false);
      setFormError(error.message);
      return;
    }

    // §4.7: existing email → neutral dual-action message, no status disclosure.
    if (data.status === "already_registered") {
      setSubmitting(false);
      setExisting(true);
      return;
    }
    router.replace(`/signup/check-email?email=${encodeURIComponent(email)}`);
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">
          Create your account
        </h1>
        <p className="text-muted-foreground text-sm">
          Launch a compliance-aware website in about fifteen minutes.
        </p>
      </header>

      {existing ? (
        <FormMessage tone="error">
          It looks like you already have a WRI account.{" "}
          <Link href="/login">Sign in</Link> or{" "}
          <Link href="/reset-password">reset your password</Link>.
        </FormMessage>
      ) : null}
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}

      <GoogleButton label="Sign up with Google" />

      <div className="flex items-center gap-3">
        <span className="bg-border h-px flex-1" />
        <span className="text-muted-foreground text-xs">or</span>
        <span className="bg-border h-px flex-1" />
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field
          id="email"
          label="Work email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setErrors((p) => ({ ...p, email: validateEmail(email) }))}
          error={errors.email}
          required
        />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() =>
            setErrors((p) => ({ ...p, password: validatePassword(password) }))
          }
          error={errors.password}
          aria-describedby="password-hint"
          required
        />
        {!errors.password ? (
          <p id="password-hint" className="text-muted-foreground -mt-2 text-xs">
            At least {MIN_PASSWORD_LENGTH} characters.
          </p>
        ) : null}

        <Button type="submit" className="h-11 w-full" disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-foreground font-medium underline underline-offset-2"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
