import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh: vi.fn() }),
}));

import { SignupForm } from "./signup-form";

function mockFetch(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => body } as Response),
  );
}

beforeEach(() => replace.mockClear());
afterEach(() => vi.restoreAllMocks());

describe("<SignupForm />", () => {
  it("shows inline validation and does not submit when fields are invalid", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const user = userEvent.setup();

    render(<SignupForm />);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(screen.getByText("Enter your email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter a password.")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("flags a malformed email on blur in real time", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText(/work email/i), "not-an-email");
    await user.tab();

    expect(
      await screen.findByText("Enter a valid email address."),
    ).toBeInTheDocument();
  });

  it("shows the §4.7 neutral message (with sign-in + reset links) for an existing account", async () => {
    mockFetch({ data: { status: "already_registered" }, error: null });
    const user = userEvent.setup();

    render(<SignupForm />);
    await user.type(screen.getByLabelText(/work email/i), "existing@example.com");
    await user.type(screen.getByLabelText(/password/i), "hunter22");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/already have a WRI account/i);
    expect(
      within(alert).getByRole("link", { name: /sign in/i }),
    ).toHaveAttribute("href", "/login");
    expect(
      within(alert).getByRole("link", { name: /reset your password/i }),
    ).toHaveAttribute("href", "/reset-password");
    // Neutral path: no navigation, no status disclosure.
    expect(replace).not.toHaveBeenCalled();
  });

  it("routes to the check-email screen when verification is sent", async () => {
    mockFetch({ data: { status: "verification_sent" }, error: null });
    const user = userEvent.setup();

    render(<SignupForm />);
    await user.type(screen.getByLabelText(/work email/i), "new@example.com");
    await user.type(screen.getByLabelText(/password/i), "hunter22");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        "/signup/check-email?email=new%40example.com",
      ),
    );
  });

  it("surfaces a server error envelope as a form message", async () => {
    mockFetch({
      data: null,
      error: { message: "Too many attempts. Please wait a moment and try again.", code: "rate_limited" },
    });
    const user = userEvent.setup();

    render(<SignupForm />);
    await user.type(screen.getByLabelText(/work email/i), "new@example.com");
    await user.type(screen.getByLabelText(/password/i), "hunter22");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
