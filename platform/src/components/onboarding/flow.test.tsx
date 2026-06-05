import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

import { OnboardingFlow } from "./flow";

/**
 * Stub fetch by URL, returning the `{data,error}` envelope each route would.
 * Records the calls so tests assert what was POSTed.
 */
function mockApi() {
  const calls: { url: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : null;
      calls.push({ url, body });
      if (url === "/api/onboarding/checkout") {
        return {
          ok: true,
          json: async () => ({
            data: { orderId: "order-abc12345", created: true },
            error: null,
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({ data: { status: "ok" }, error: null }) } as Response;
    }),
  );
  return calls;
}

beforeEach(() => push.mockClear());
afterEach(() => vi.restoreAllMocks());

describe("<OnboardingFlow />", () => {
  it("renders the industry step first with the progress rail", () => {
    mockApi();
    render(<OnboardingFlow initialStep="industry" initialOrderId={null} />);
    expect(
      screen.getByRole("heading", { name: /what kind of practice/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/step 1 of 3/i)).toBeInTheDocument();
    expect(
      screen.getByText(/financial advisory \(ria\)/i),
    ).toBeInTheDocument();
  });

  it("captures a waitlist email on a non-RIA card without leaving the flow", async () => {
    const calls = mockApi();
    const user = userEvent.setup();
    render(<OnboardingFlow initialStep="industry" initialOrderId={null} />);

    await user.click(screen.getByRole("button", { name: /insurance/i }));
    const email = screen.getByLabelText(/email for the insurance waitlist/i);
    await user.type(email, "advisor@firm.com");
    await user.click(screen.getByRole("button", { name: /notify me/i }));

    expect(await screen.findByText(/you're on the insurance waitlist/i)).toBeInTheDocument();
    expect(calls).toContainEqual({
      url: "/api/waitlist",
      body: { email: "advisor@firm.com", industry: "insurance" },
    });
    // still on the industry step (RIA path untouched)
    expect(
      screen.getByRole("heading", { name: /what kind of practice/i }),
    ).toBeInTheDocument();
  });

  it("walks RIA → sub-class → payment → build handoff, creating the order", async () => {
    const calls = mockApi();
    const user = userEvent.setup();
    render(<OnboardingFlow initialStep="industry" initialOrderId={null} />);

    // pick RIA → saves industry, advances to sub-class
    await user.click(
      screen.getByRole("button", { name: /financial advisory \(ria\)/i }),
    );
    expect(
      await screen.findByRole("heading", { name: /registered investment advisor/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/step 2 of 3/i)).toBeInTheDocument();

    // confirm sub-class → advances to payment
    await user.click(screen.getByRole("button", { name: /that's me/i }));
    expect(
      await screen.findByRole("heading", { name: /start your wri subscription/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("$50")).toBeInTheDocument();
    expect(screen.getByText(/no charge while/i)).toBeInTheDocument();

    // start build → checkout creates order, lands on handoff
    await user.click(screen.getByRole("button", { name: /start my site/i }));
    expect(
      await screen.findByRole("heading", { name: /your site is being built/i }),
    ).toBeInTheDocument();

    // the three POSTs happened with the right bodies
    expect(calls).toEqual([
      { url: "/api/onboarding/selection", body: { industry: "ria" } },
      { url: "/api/onboarding/selection", body: { subIndustry: "ria_only" } },
      { url: "/api/onboarding/checkout", body: {} },
    ]);
  });

  it("resumes directly at the handoff when an order already exists", () => {
    mockApi();
    render(<OnboardingFlow initialStep="handoff" initialOrderId="order-deadbeef" />);
    expect(
      screen.getByRole("heading", { name: /your site is being built/i }),
    ).toBeInTheDocument();
    // progress rail is hidden on the terminal screen
    expect(screen.queryByText(/step \d of 3/i)).not.toBeInTheDocument();
  });

  it("surfaces a server error on the industry step instead of advancing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: null,
          error: { message: "Account not found.", code: "account_missing" },
        }),
      })) as never,
    );
    const user = userEvent.setup();
    render(<OnboardingFlow initialStep="industry" initialOrderId={null} />);

    await user.click(
      screen.getByRole("button", { name: /financial advisory \(ria\)/i }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(/account not found/i);
    // did not advance
    expect(
      screen.getByRole("heading", { name: /what kind of practice/i }),
    ).toBeInTheDocument();
  });
});
