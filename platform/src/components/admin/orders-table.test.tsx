import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { AdminOrdersTable } from "./orders-table";
import type { AdminOrder } from "@/lib/admin/orders";

function makeOrder(over: Partial<AdminOrder> = {}): AdminOrder {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    status: "scraping",
    stateLabel: "Scraping",
    tone: "info",
    group: "in_progress",
    firmName: "Cedar Ridge Wealth",
    email: "jane@cedar.com",
    createdAt: "2026-06-01T10:00:00Z",
    timeInStateMs: 5 * 60 * 1000,
    lastFailureReason: null,
    retryCount: 0,
    alert: null,
    retriable: false,
    ...over,
  };
}

const FAILED = makeOrder({
  id: "fail0000-0000-0000-0000-000000000000",
  status: "build_failed",
  stateLabel: "Build failed",
  tone: "danger",
  group: "failed",
  lastFailureReason: "astro build crashed",
  retriable: true,
  retryCount: 1,
  alert: { id: "alert-1", type: "order_failed", step: "build", message: "astro build crashed", createdAt: "2026-06-01T11:30:00Z" },
});

function mockFetch(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ json: async () => body } as Response),
  );
}

beforeEach(() => refresh.mockClear());
afterEach(() => vi.restoreAllMocks());

describe("<AdminOrdersTable />", () => {
  it("renders a row per order with account identity, color-coded state, and failure reason", () => {
    render(<AdminOrdersTable orders={[makeOrder(), FAILED]} filters={{}} />);

    expect(screen.getAllByText("Cedar Ridge Wealth").length).toBeGreaterThan(0);
    expect(screen.getByText("astro build crashed")).toBeInTheDocument();

    // failed state badge carries the destructive (red) styling = color coding
    const failBadge = screen.getByText("Build failed");
    expect(failBadge.className).toMatch(/destructive/);
    expect(screen.getByText("Scraping").className).not.toMatch(/destructive/);
  });

  it("shows the empty state when there are no orders", () => {
    render(<AdminOrdersTable orders={[]} filters={{ group: "failed" }} />);
    expect(screen.getByText(/no orders match/i)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("only offers actions on actionable rows", () => {
    render(<AdminOrdersTable orders={[makeOrder()]} filters={{}} />);
    // a healthy in-progress order is neither retriable nor alerting → no buttons
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /dismiss/i })).not.toBeInTheDocument();
  });

  it("retries through a confirm step: POSTs to the retry route and refreshes", async () => {
    mockFetch({ data: { status: "payment_received", retryCount: 2 }, error: null });
    const user = userEvent.setup();
    render(<AdminOrdersTable orders={[FAILED]} filters={{}} />);

    await user.click(screen.getByRole("button", { name: /retry/i }));
    // confirm step appears before anything is sent
    expect(screen.getByText(/re-run build\?/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /confirm/i }));

    expect(fetch).toHaveBeenCalledWith(
      `/api/admin/orders/${FAILED.id}/retry`,
      expect.objectContaining({ method: "POST" }),
    );
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("surfaces an action error instead of refreshing", async () => {
    mockFetch({ data: null, error: { message: "Only a failed order can be retried.", code: "not_retriable" } });
    const user = userEvent.setup();
    render(<AdminOrdersTable orders={[FAILED]} filters={{}} />);

    await user.click(screen.getByRole("button", { name: /retry/i }));
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    expect(await screen.findByText(/only a failed order can be retried/i)).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("renders the dismiss action when an order carries an unresolved alert", () => {
    render(<AdminOrdersTable orders={[FAILED]} filters={{}} />);
    expect(screen.getByRole("button", { name: /dismiss alert/i })).toBeInTheDocument();
  });

  it("reflects the active filter in the state select", () => {
    render(<AdminOrdersTable orders={[FAILED]} filters={{ group: "failed" }} />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("failed");
    // a Clear control appears once a filter is active
    expect(screen.getByRole("link", { name: /clear/i })).toBeInTheDocument();
  });
});
