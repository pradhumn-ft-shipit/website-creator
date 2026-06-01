import { describe, expect, it } from "vitest";

import { activeNavKey, DASHBOARD_NAV } from "./nav";

describe("DASHBOARD_NAV", () => {
  it("lists all eight §12.1 sections in order", () => {
    expect(DASHBOARD_NAV.map((i) => i.key)).toEqual([
      "overview",
      "edit",
      "assets",
      "team",
      "leads",
      "blog",
      "billing",
      "settings",
    ]);
  });

  it("marks Site Overview and Settings ready; the rest are coming-soon", () => {
    const ready = DASHBOARD_NAV.filter((i) => i.ready).map((i) => i.key);
    expect(ready).toEqual(["overview", "settings"]);
    // every not-ready item names the ticket that will deliver it
    for (const item of DASHBOARD_NAV.filter((i) => !i.ready)) {
      expect(item.blockedByTicket).toBeTruthy();
    }
  });
});

describe("activeNavKey", () => {
  it("matches Site Overview on the exact /dashboard root", () => {
    expect(activeNavKey("/dashboard")).toBe("overview");
  });

  it("uses longest-prefix so nested routes highlight their tab", () => {
    expect(activeNavKey("/dashboard/leads")).toBe("leads");
    expect(activeNavKey("/dashboard/leads/abc-123")).toBe("leads");
    expect(activeNavKey("/dashboard/settings")).toBe("settings");
  });

  it("does not highlight overview for a nested route", () => {
    expect(activeNavKey("/dashboard/billing")).not.toBe("overview");
  });

  it("returns null for a path outside the dashboard", () => {
    expect(activeNavKey("/login")).toBeNull();
  });
});
