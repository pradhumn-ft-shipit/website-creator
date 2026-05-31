import Link from "next/link";
import type { Metadata } from "next";
import { MailCheck } from "lucide-react";

export const metadata: Metadata = { title: "Check your email · WRI" };

/**
 * Post-signup "check your email" screen. The address is passed through the
 * query string purely to personalize the copy — no session exists yet, and the
 * advisor can't proceed until they click the verification link (§4.1 step 3).
 */
export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <span className="bg-accent text-accent-foreground flex size-12 items-center justify-center rounded-full">
          <MailCheck className="size-6" aria-hidden />
        </span>
      </div>

      <header className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Check your email</h1>
        <p className="text-muted-foreground text-sm">
          We sent a verification link to{" "}
          {email ? (
            <span className="text-foreground font-medium break-all">{email}</span>
          ) : (
            "your inbox"
          )}
          . Click it to activate your account.
        </p>
      </header>

      <p className="text-muted-foreground text-xs">
        The link expires in 24 hours. Didn&apos;t get it? Check your spam folder,
        or try signing up again.
      </p>

      <Link
        href="/login"
        className="text-foreground inline-block text-sm font-medium underline underline-offset-2"
      >
        Back to sign in
      </Link>
    </div>
  );
}
