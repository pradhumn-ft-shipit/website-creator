import { Suspense } from "react";
import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · WRI" };

export default function LoginPage() {
  // LoginForm reads search params (next, error) — needs a Suspense boundary.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
