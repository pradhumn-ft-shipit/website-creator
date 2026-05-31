import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { HealthStatus } from "./health-status";

function mockFetch(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: async () => body,
  } as Response);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("<HealthStatus />", () => {
  it("renders the server-provided initial status immediately", () => {
    render(<HealthStatus initialStatus="ok" />);
    expect(screen.getByTestId("health-result")).toHaveTextContent("status: ok");
  });

  it("re-checks against /api/health and renders the success envelope", async () => {
    const fetchMock = mockFetch({ data: { status: "ok" }, error: null });
    vi.stubGlobal("fetch", fetchMock);

    render(<HealthStatus initialStatus="ok" />);
    await userEvent.click(screen.getByRole("button", { name: /re-check/i }));

    await waitFor(() =>
      expect(screen.getByTestId("health-result")).toHaveTextContent(
        "status: ok",
      ),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/health",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("renders the error message when the envelope carries an error", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        data: null,
        error: { message: "Service unavailable", code: "internal_error" },
      }),
    );

    render(<HealthStatus initialStatus="ok" />);
    await userEvent.click(screen.getByRole("button", { name: /re-check/i }));

    await waitFor(() =>
      expect(screen.getByTestId("health-result")).toHaveTextContent(
        "Service unavailable",
      ),
    );
  });

  it("shows a friendly message when the network call throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );

    render(<HealthStatus initialStatus="ok" />);
    await userEvent.click(screen.getByRole("button", { name: /re-check/i }));

    await waitFor(() =>
      expect(screen.getByTestId("health-result")).toHaveTextContent(
        "Could not reach the API.",
      ),
    );
  });
});
