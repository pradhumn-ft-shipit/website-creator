"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Field } from "@/components/auth/field";
import { FormMessage } from "@/components/auth/form-message";
import { GoogleButton } from "@/components/auth/google-button";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/api/client";
import { validateEmail } from "@/lib/auth/validation";

type FieldErrors = { email?: string | null; password?: string | null };

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const callbackFailed = params.get("error") === "auth_callback";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const emailError = validateEmail(email);
    const passwordError = password ? null : "Enter your password.";
    if (emailError || passwordError) {
      setErrors({ email: emailError, password: passwordError });
      return;
    }
    setErrors({});

    setSubmitting(true);
    const { error } = await postJson<{ userId: string }>("/api/auth/login", {
      email,
      password,
    });
    if (error) {
      setSubmitting(false);
      setFormError(error.message);
      return;
    }
    // Session cookies are set on the response; refresh so Server Components
    // re-render as authenticated, then land on the intended destination.
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground text-sm">
          Sign in to manage your website.
        </p>
      </header>

      {callbackFailed ? (
        <FormMessage tone="error">
          That sign-in link didn&apos;t work or has expired. Please try again.
        </FormMessage>
      ) : null}
      {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}

      <GoogleButton label="Continue with Google" next={next} />

      <div className="flex items-center gap-3">
        <span className="bg-border h-px flex-1" />
        <span className="text-muted-foreground text-xs">or</span>
        <span className="bg-border h-px flex-1" />
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setErrors((p) => ({ ...p, email: validateEmail(email) }))}
          error={errors.email}
          required
        />
        <div className="space-y-1.5">
          <Field
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            required
          />
          <div className="text-right">
            <Link
              href="/reset-password"
              className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <Button type="submit" className="h-11 w-full" disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-muted-foreground text-center text-sm">
        New to WRI?{" "}
        <Link
          href="/signup"
          className="text-foreground font-medium underline underline-offset-2"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}

function safeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/dashboard";
}
