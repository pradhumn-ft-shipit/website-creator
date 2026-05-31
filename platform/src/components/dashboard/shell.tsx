"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, ShieldCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { SidebarNav } from "./sidebar-nav";
import { SignOutButton } from "./sign-out-button";

function Brand() {
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-2 text-sm font-semibold tracking-tight"
    >
      <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
        <ShieldCheck className="size-4" aria-hidden />
      </span>
      WRI
    </Link>
  );
}

function AccountFooter({
  firmName,
  email,
}: {
  firmName: string | null;
  email: string;
}) {
  return (
    <div className="border-t p-3">
      <div className="min-w-0 px-2 pb-2">
        <p className="truncate text-sm font-medium">
          {firmName ?? "Your firm"}
        </p>
        <p className="text-muted-foreground truncate text-xs">{email}</p>
      </div>
      <SignOutButton />
    </div>
  );
}

/**
 * Authenticated dashboard shell (PRD §12.1, §7.3). Fixed sidebar on desktop,
 * slide-over drawer on mobile, with a sticky top bar carrying the menu toggle.
 * Resolved account identity (firm name + email) is passed in from the server
 * layout so this client component stays serializable.
 */
export function DashboardShell({
  firmName,
  email,
  children,
}: {
  firmName: string | null;
  email: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-svh flex-1">
      {/* Desktop sidebar */}
      <aside className="bg-card hidden w-64 shrink-0 flex-col border-r lg:flex">
        <div className="flex h-14 items-center px-5">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <SidebarNav />
        </div>
        <AccountFooter firmName={firmName} email={email} />
      </aside>

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-0 z-40 lg:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!open}
      >
        <div
          className={cn(
            "bg-foreground/30 absolute inset-0 transition-opacity",
            open ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setOpen(false)}
        />
        <aside
          className={cn(
            "bg-card absolute inset-y-0 left-0 flex w-72 max-w-[80%] flex-col border-r shadow-xl transition-transform",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex h-14 items-center justify-between px-5">
            <Brand />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X aria-hidden />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2">
            <SidebarNav onNavigate={() => setOpen(false)} />
          </div>
          <AccountFooter firmName={firmName} email={email} />
        </aside>
      </div>

      {/* Content column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-card/80 sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 backdrop-blur lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu aria-hidden />
          </Button>
          <Brand />
        </header>
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
