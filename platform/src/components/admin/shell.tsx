"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { cn } from "@/lib/utils";

/**
 * Internal admin console shell (PRD §11, §7.10). A dense, desktop-first chrome
 * distinct from the advisor dashboard — same 00A tokens/primitives, but a top
 * nav across the §11 admin surfaces. Only Orders is live (033); the rest carry a
 * "Soon" pill and name no dead-ends (delivered by 034–036). §7.10 allows
 * lower-fidelity admin UI, but never a broken screen.
 */
const ADMIN_SECTIONS: { label: string; href: string; ready: boolean }[] = [
  { label: "Orders", href: "/admin/orders", ready: true },
  { label: "Compliance", href: "/admin/compliance", ready: true },
  { label: "Leads", href: "/admin/leads", ready: false },
  { label: "Email log", href: "/admin/email-log", ready: false },
  { label: "Health", href: "/admin/health", ready: false },
];

function NavLink({
  label,
  href,
  ready,
  active,
}: {
  label: string;
  href: string;
  ready: boolean;
  active: boolean;
}) {
  if (!ready) {
    return (
      <span className="text-muted-foreground flex cursor-default items-center gap-1.5 px-3 py-2 text-sm font-medium">
        {label}
        <span className="border-border text-foreground/75 rounded-full border px-1.5 py-px text-[10px] font-medium tracking-wide uppercase">
          Soon
        </span>
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        active
          ? "bg-primary/10 text-foreground font-semibold"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}

export function AdminShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-card/80 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link
            href="/admin/orders"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight"
          >
            <span className="bg-foreground text-background flex size-7 items-center justify-center rounded-lg">
              <ShieldAlert className="size-4" aria-hidden />
            </span>
            WRI
            <span className="text-muted-foreground font-normal">· Admin</span>
          </Link>
          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Admin sections"
          >
            {ADMIN_SECTIONS.map((s) => (
              <NavLink
                key={s.href}
                {...s}
                active={pathname === s.href || pathname.startsWith(`${s.href}/`)}
              />
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-muted-foreground hidden text-xs sm:inline">
              {email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
        {children}
      </main>
    </div>
  );
}
