import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { OrderDetail } from "./order-detail";
import type { AdminOrderDetail } from "@/lib/admin/orders";

function makeDetail(over: Partial<AdminOrderDetail> = {}): AdminOrderDetail {
  return {
    id: "fail0000-1111-2222-3333-444444444444",
    status: "deploy_failed",
    stateLabel: "Deploy failed",
    tone: "danger",
    group: "failed",
    firmName: "Cedar Ridge Wealth",
    email: "jane@cedar.com",
    createdAt: "2026-06-01T10:00:00Z",
    completedAt: null,
    retryCount: 1,
    failureReason: "Vercel returned 502",
    retriable: true,
    alert: { id: "al1", type: "order_failed", step: "deploy", message: "Vercel returned 502", createdAt: "2026-06-01T11:35:00Z" },
    history: [
      { status: "payment_received", label: "Payment received", tone: "info", enteredAt: "2026-06-01T10:00:00Z", durationMs: 600000, note: null, isCurrent: false },
      { status: "deploying", label: "Deploying", tone: "info", enteredAt: "2026-06-01T11:20:00Z", durationMs: 900000, note: null, isCurrent: true },
    ],
    intake: {
      existingSiteUrl: "https://old.example.com",
      hasScrapeResult: true,
      uploadedDocCount: 2,
      hasStructuredIntake: false,
    },
    content: [
      { id: "c2", version: 2, page: "about", section: null, confidenceScore: 0.8, complianceVersionUsed: "ria/v1.0", generatedAt: "2026-06-01T11:10:00Z", approved: false },
      { id: "c1", version: 1, page: "home", section: "hero", confidenceScore: 0.91, complianceVersionUsed: "ria/v1.0", generatedAt: "2026-06-01T10:50:00Z", approved: true },
    ],
    violations: [
      { id: "v1", severity: "high", fieldPath: "home.hero.headline", description: "Implied performance guarantee", rulesetVersion: "ria/v1.0", resolved: false, resolutionAction: null },
    ],
    deployments: [
      { id: "d1", status: "error", contentVersion: 2, triggeredBy: "system", compliancePassed: true, vercelDeploymentId: "dpl_2", deployedAt: "2026-06-01T11:30:00Z" },
    ],
    ...over,
  };
}

function mockFetch(body: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => body } as Response));
}

beforeEach(() => refresh.mockClear());
afterEach(() => vi.restoreAllMocks());

describe("<OrderDetail />", () => {
  it("shows the order identity, state, and failure callout", () => {
    render(<OrderDetail detail={makeDetail()} />);
    expect(screen.getByText("Cedar Ridge Wealth")).toBeInTheDocument();
    expect(screen.getByText("jane@cedar.com")).toBeInTheDocument();
    expect(screen.getByText("Deploy failed").className).toMatch(/destructive/);
    // failure callout names the failing step + reason
    expect(screen.getByText(/failed at: deploy/i)).toBeInTheDocument();
    expect(screen.getByText("Vercel returned 502")).toBeInTheDocument();
  });

  it("renders the state-machine history timeline with the current state flagged", () => {
    render(<OrderDetail detail={makeDetail()} />);
    expect(screen.getByText("Payment received")).toBeInTheDocument();
    expect(screen.getByText("Deploying")).toBeInTheDocument();
    expect(screen.getByText("current")).toBeInTheDocument();
  });

  it("summarizes intake, content versions, violations, and deployments", () => {
    render(<OrderDetail detail={makeDetail()} />);
    // intake
    expect(screen.getByText("https://old.example.com")).toBeInTheDocument();
    // content: both pages render, newest first
    expect(screen.getByText("about")).toBeInTheDocument();
    expect(screen.getByText("home")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
    // violation
    expect(screen.getByText("Implied performance guarantee")).toBeInTheDocument();
    expect(screen.getByText("high").className).toMatch(/destructive/);
    // deployment row
    expect(screen.getByText("dpl_2")).toBeInTheDocument();
  });

  it("offers a working Retry action through a confirm step", async () => {
    mockFetch({ data: { status: "payment_received", retryCount: 2 }, error: null });
    const user = userEvent.setup();
    render(<OrderDetail detail={makeDetail()} />);

    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(screen.getByText(/re-run build\?/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /confirm/i }));
    expect(fetch).toHaveBeenCalledWith(
      `/api/admin/orders/${makeDetail().id}/retry`,
      expect.objectContaining({ method: "POST" }),
    );
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("renders empty states when a healthy order has no related rows", () => {
    render(
      <OrderDetail
        detail={makeDetail({
          status: "scraping",
          stateLabel: "Scraping",
          tone: "info",
          group: "in_progress",
          retriable: false,
          failureReason: null,
          alert: null,
          intake: null,
          content: [],
          violations: [],
          deployments: [],
        })}
      />,
    );
    expect(screen.getByText(/no content generated yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no violations recorded/i)).toBeInTheDocument();
    expect(screen.getByText(/no deployments yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no intake captured/i)).toBeInTheDocument();
    // a healthy order shows no Retry/Dismiss and no failure callout
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/failure/i)).not.toBeInTheDocument();
  });
});
