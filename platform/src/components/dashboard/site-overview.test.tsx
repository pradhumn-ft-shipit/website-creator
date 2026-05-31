import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { SiteOverview } from "@/lib/dashboard/overview";

import { SiteOverviewView } from "./site-overview";

const LIVE: SiteOverview = {
  subdomainUrl: "https://acme.vercel.app",
  customDomain: "advisor.com",
  domainStatus: "verified",
  lastDeployedAt: "2026-05-30T12:00:00Z",
  templateId: "trust",
  templateLabel: "Trust",
  liveUrl: "https://advisor.com",
};

describe("SiteOverviewView", () => {
  it("renders the not-live empty state when there is no site yet", () => {
    render(<SiteOverviewView overview={null} />);
    expect(screen.getByText(/isn.t live yet/i)).toBeInTheDocument();
    // no "Visit live site" action in the empty state
    expect(
      screen.queryByRole("link", { name: /visit live site/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the live URL, template, and a verified domain badge", () => {
    render(<SiteOverviewView overview={LIVE} />);
    expect(
      screen.getByRole("link", { name: /visit live site/i }),
    ).toHaveAttribute("href", "https://advisor.com");
    expect(screen.getByText("Trust")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it("disables Visit live site and shows Pending before the domain verifies", () => {
    render(
      <SiteOverviewView
        overview={{
          ...LIVE,
          domainStatus: "pending",
          customDomain: "advisor.com",
          liveUrl: "https://acme.vercel.app",
        }}
      />,
    );
    expect(screen.getByText("Pending verification")).toBeInTheDocument();
    // live URL falls back to the subdomain, so the visit action is enabled
    expect(
      screen.getByRole("link", { name: /visit live site/i }),
    ).toHaveAttribute("href", "https://acme.vercel.app");
  });

  it("disables the visit action entirely before the first deploy", () => {
    render(
      <SiteOverviewView
        overview={{
          ...LIVE,
          subdomainUrl: null,
          customDomain: null,
          domainStatus: "not_configured",
          liveUrl: null,
          lastDeployedAt: null,
        }}
      />,
    );
    expect(
      screen.queryByRole("link", { name: /visit live site/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /visit live site/i }),
    ).toBeDisabled();
    expect(screen.getByText("Not configured")).toBeInTheDocument();
  });
});
