import {
  CreditCard,
  FileText,
  ImageIcon,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Single source of truth for the customer-dashboard navigation (PRD §12.1).
 * Every tab lives here so the sidebar, mobile menu, and per-route headers stay
 * in lockstep. `ready: false` tabs render a designed "coming soon" placeholder
 * (PRD §7.10 — lower fidelity is fine, broken/half-built screens are not) and
 * name the ticket that will deliver them, so the stub never reads as a dead end.
 */
export type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** false → the tab exists in nav but routes to a coming-soon placeholder. */
  ready: boolean;
  /** Which ticket delivers a not-yet-ready tab (shown in the placeholder). */
  blockedByTicket?: string;
};

export const DASHBOARD_NAV: NavItem[] = [
  {
    key: "overview",
    label: "Site Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    ready: true,
  },
  {
    key: "edit",
    label: "Edit Site",
    href: "/dashboard/edit",
    icon: MessageSquare,
    ready: false,
    blockedByTicket: "029",
  },
  {
    key: "assets",
    label: "Assets",
    href: "/dashboard/assets",
    icon: ImageIcon,
    ready: false,
    blockedByTicket: "030",
  },
  {
    key: "team",
    label: "Team",
    href: "/dashboard/team",
    icon: Users,
    ready: false,
    blockedByTicket: "030",
  },
  {
    key: "leads",
    label: "Leads",
    href: "/dashboard/leads",
    icon: Inbox,
    ready: false,
    blockedByTicket: "028",
  },
  {
    key: "blog",
    label: "Blog",
    href: "/dashboard/blog",
    icon: FileText,
    ready: false,
    blockedByTicket: "031",
  },
  {
    key: "billing",
    label: "Billing",
    href: "/dashboard/billing",
    icon: CreditCard,
    ready: false,
    blockedByTicket: "032",
  },
  {
    key: "settings",
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    ready: true,
  },
];

/**
 * Which nav tab owns the given pathname, by longest-prefix match — so
 * `/dashboard/leads/abc` highlights Leads while the exact `/dashboard` root
 * highlights Site Overview (every tab is under `/dashboard`, and the root is
 * the shortest prefix). Returns null outside the dashboard.
 */
export function activeNavKey(pathname: string): string | null {
  let match: NavItem | null = null;
  for (const item of DASHBOARD_NAV) {
    const isMatch =
      pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (!isMatch) continue;
    if (!match || item.href.length > match.href.length) match = item;
  }
  return match?.key ?? null;
}
