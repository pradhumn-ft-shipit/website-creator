import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";

import { FormMessage } from "@/components/auth/form-message";
import { requireUser } from "@/lib/auth/session";

import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = { title: "Dashboard · WRI" };

/**
 * Placeholder authenticated landing — proves the auth boundary end-to-end
 * (middleware lets verified sessions through; everyone else is bounced to
 * /login). Ticket 027 replaces this with the real dashboard shell + Site
 * Overview; for now it just confirms who's signed in and offers sign-out.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string }>;
}) {
  const user = await requireUser();
  const { verified } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-16">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <SignOutButton />
      </div>

      {verified ? (
        <div className="mt-6">
          <FormMessage tone="success">
            Your email is verified — your account is ready.
          </FormMessage>
        </div>
      ) : null}

      <div className="bg-card mt-6 rounded-xl border p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="bg-success/10 text-success flex size-9 items-center justify-center rounded-lg">
            <CheckCircle2 className="size-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-medium">You&apos;re signed in</p>
            <p className="text-muted-foreground text-xs">{user.email}</p>
          </div>
        </div>
        <p className="text-muted-foreground mt-4 text-sm">
          This is a placeholder. The full dashboard — Site Overview, edit chat,
          leads, and billing — arrives with ticket 027.
        </p>
      </div>
    </main>
  );
}
