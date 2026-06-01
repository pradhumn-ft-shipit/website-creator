"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { activeNavKey, DASHBOARD_NAV } from "@/lib/dashboard/nav";
import { cn } from "@/lib/utils";

/**
 * The §12.1 nav, shared by the desktop sidebar and the mobile drawer. Active
 * tab comes from the pathname (longest-prefix, see `activeNavKey`); not-ready
 * tabs carry a quiet "Soon" badge so the advisor sees the full map without
 * hitting a broken screen (§7.10). `onNavigate` lets the mobile drawer close
 * on selection.
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = activeNavKey(pathname);

  return (
    <nav className="flex flex-col gap-1" aria-label="Dashboard">
      {DASHBOARD_NAV.map((item) => {
        const Icon = item.icon;
        const isActive = item.key === active;
        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-primary/10 text-accent-foreground font-semibold"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">{item.label}</span>
            {!item.ready ? (
              <span className="border-border text-foreground/75 rounded-full border px-1.5 py-px text-[10px] font-medium tracking-wide uppercase">
                Soon
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
