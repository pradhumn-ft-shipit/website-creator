import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SidebarNav } from "./sidebar-nav";

// usePathname drives the active-tab highlight.
const pathname = vi.hoisted(() => ({ value: "/dashboard" }));
vi.mock("next/navigation", () => ({
  usePathname: () => pathname.value,
}));

describe("SidebarNav", () => {
  it("renders all eight §12.1 tabs as links", () => {
    pathname.value = "/dashboard";
    render(<SidebarNav />);
    for (const label of [
      "Site Overview",
      "Edit Site",
      "Assets",
      "Team",
      "Leads",
      "Blog",
      "Billing",
      "Settings",
    ]) {
      expect(screen.getByRole("link", { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it("marks not-ready tabs with a Soon badge but Site Overview without one", () => {
    pathname.value = "/dashboard";
    render(<SidebarNav />);
    // 6 of 8 tabs are coming-soon now (Site Overview + Settings are live)
    expect(screen.getAllByText("Soon")).toHaveLength(6);
    const overview = screen.getByRole("link", { name: /Site Overview/ });
    expect(overview).not.toHaveTextContent("Soon");
  });

  it("highlights the active tab via aria-current using longest-prefix match", () => {
    pathname.value = "/dashboard/leads/abc-123";
    render(<SidebarNav />);
    expect(screen.getByRole("link", { name: /Leads/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: /Site Overview/ }),
    ).not.toHaveAttribute("aria-current");
  });
});
