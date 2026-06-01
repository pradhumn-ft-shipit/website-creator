import Link from "next/link";
import { ShieldCheck } from "lucide-react";

/**
 * Shared chrome for every auth screen: a centered card on a quiet, branded
 * backdrop. Kept deliberately calm and trustworthy — these are the first
 * screens a regulated advisor sees (PRD §7.3 tone).
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-svh flex-1 flex-col items-center justify-center px-4 py-12">
      {/* soft radial wash behind the card for depth, not decoration */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_40rem_at_50%_-10%,var(--color-accent),transparent)] opacity-60"
      />
      <Link
        href="/"
        className="text-foreground mb-8 inline-flex items-center gap-2 text-sm font-semibold tracking-tight"
      >
        <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-lg">
          <ShieldCheck className="size-4" aria-hidden />
        </span>
        WRI
      </Link>

      <div className="bg-card w-full max-w-sm rounded-2xl border p-7 shadow-card">
        {children}
      </div>

      <p className="text-muted-foreground mt-6 max-w-xs text-center text-xs">
        Compliance-aware websites for SEC- and state-registered investment
        advisers.
      </p>
    </main>
  );
}
