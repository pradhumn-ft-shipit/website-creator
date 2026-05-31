import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const replace = vi.fn();
const refresh = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
  useSearchParams: () => searchParams,
}));

import { LoginForm } from "./login-form";

function mockFetch(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => body } as Response),
  );
}

beforeEach(() => {
  replace.mockClear();
  refresh.mockClear();
  searchParams = new URLSearchParams();
});
afterEach(() => vi.restoreAllMocks());

describe("<LoginForm />", () => {
  it("signs in and navigates to the default destination on success", async () => {
    mockFetch({ data: { userId: "u1" }, error: null });
    const user = userEvent.setup();

    render(<LoginForm />);
    await user.type(screen.getByLabelText(/email/i), "advisor@example.com");
    await user.type(screen.getByLabelText(/password/i), "hunter22");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
    expect(refresh).toHaveBeenCalled();
  });

  it("honors a safe ?next destination", async () => {
    searchParams = new URLSearchParams("next=/dashboard/settings");
    mockFetch({ data: { userId: "u1" }, error: null });
    const user = userEvent.setup();

    render(<LoginForm />);
    await user.type(screen.getByLabelText(/email/i), "advisor@example.com");
    await user.type(screen.getByLabelText(/password/i), "hunter22");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/dashboard/settings"),
    );
  });

  it("renders the error envelope and stays on the page", async () => {
    mockFetch({
      data: null,
      error: { message: "That email or password is incorrect.", code: "invalid_credentials" },
    });
    const user = userEvent.setup();

    render(<LoginForm />);
    await user.type(screen.getByLabelText(/email/i), "advisor@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrongpass1");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      await screen.findByText("That email or password is incorrect."),
    ).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows a non-alarming banner when an auth callback link failed", () => {
    searchParams = new URLSearchParams("error=auth_callback");
    render(<LoginForm />);
    expect(
      screen.getByText(/that sign-in link didn't work or has expired/i),
    ).toBeInTheDocument();
  });
});
