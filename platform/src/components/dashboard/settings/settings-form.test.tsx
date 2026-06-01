import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

import { SettingsForm } from "./settings-form";
import type { AccountSettings } from "@/lib/account/settings";

const BASE: AccountSettings = {
  email: "advisor@example.com",
  fullName: "Jane Advisor",
  firmName: "Cedar Ridge Wealth",
  notifications: { leadFrequency: "instant", systemAlerts: true },
  deletion: { pending: false, graceEndsAt: null, daysRemaining: null },
};

function mockFetch(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => body } as Response),
  );
}

beforeEach(() => refresh.mockClear());
afterEach(() => vi.restoreAllMocks());

describe("<SettingsForm />", () => {
  it("renders the §12.9 surfaces with current values prefilled", () => {
    render(<SettingsForm settings={BASE} />);
    expect(screen.getByLabelText(/your name/i)).toHaveValue("Jane Advisor");
    expect(screen.getByLabelText(/email address/i)).toHaveValue(
      "advisor@example.com",
    );
    // notification prefs reflect stored state
    expect(
      screen.getByRole("radio", { name: /every new lead/i }),
    ).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /system alerts/i })).toBeChecked();
    // password + danger zone present
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /delete account/i }),
    ).toBeInTheDocument();
  });

  it("saves the profile and confirms inline", async () => {
    mockFetch({ data: { status: "saved" }, error: null });
    const user = userEvent.setup();
    render(<SettingsForm settings={BASE} />);

    await user.clear(screen.getByLabelText(/your name/i));
    await user.type(screen.getByLabelText(/your name/i), "Jane Q. Advisor");
    await user.click(screen.getByRole("button", { name: /save profile/i }));

    expect(await screen.findByText("Profile saved.")).toBeInTheDocument();
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("/api/account/profile");
    expect(JSON.parse(call[1].body)).toMatchObject({ fullName: "Jane Q. Advisor" });
  });

  it("disables the email update until the address changes", async () => {
    render(<SettingsForm settings={BASE} />);
    expect(screen.getByRole("button", { name: /update email/i })).toBeDisabled();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email address/i), "x");
    expect(
      screen.getByRole("button", { name: /update email/i }),
    ).toBeEnabled();
  });

  it("tells the advisor to confirm from the new inbox after an email change", async () => {
    mockFetch({ data: { status: "confirmation_sent" }, error: null });
    const user = userEvent.setup();
    render(<SettingsForm settings={BASE} />);

    const email = screen.getByLabelText(/email address/i);
    await user.clear(email);
    await user.type(email, "new@example.com");
    await user.click(screen.getByRole("button", { name: /update email/i }));

    expect(
      await screen.findByText(/sent a confirmation link to new@example.com/i),
    ).toBeInTheDocument();
  });

  it("requires a two-step confirm before scheduling deletion", async () => {
    mockFetch({ data: { status: "scheduled", graceEndsAt: "x" }, error: null });
    const user = userEvent.setup();
    render(<SettingsForm settings={BASE} />);

    // first click reveals the confirm, does not call the API
    await user.click(screen.getByRole("button", { name: /^delete account$/i }));
    expect(screen.getByText(/delete your account\?/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: /yes, schedule deletion/i }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      "/api/account/deletion",
    );
  });

  it("shows the grace-window banner and a cancel action when deletion is pending", () => {
    render(
      <SettingsForm
        settings={{
          ...BASE,
          deletion: {
            pending: true,
            graceEndsAt: "2026-07-01T00:00:00.000Z",
            daysRemaining: 12,
          },
        }}
      />,
    );
    expect(screen.getByText(/12 days left/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /keep my account/i }),
    ).toBeInTheDocument();
  });
});
