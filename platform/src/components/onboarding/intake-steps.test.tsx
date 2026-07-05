import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { IntakeFlow } from "./intake-steps";

interface Call {
  url: string;
  method: string;
  body: unknown;
}

/**
 * Stub every intake endpoint by URL + method. GET /api/onboarding/intake seeds
 * the extracted blob so the confirm-or-correct screen renders "We think X";
 * POSTs record their bodies for assertion.
 */
function mockApi() {
  const calls: Call[] = [];
  const extracted = {
    intake: {
      firmName: { value: "Meridian Wealth", confidence: 0.98, sources: ["/"] },
      yearFounded: { value: 2011, confidence: 0.9, sources: [] },
      teamSize: { value: 3, confidence: 0.5, sources: [] },
      brandColors: { value: ["1f6f52"], confidence: 0.8, sources: ["/"] },
    },
    firmName: "Meridian Wealth",
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : init?.body ?? null;
      calls.push({ url, method, body });
      if (url === "/api/onboarding/intake" && method === "GET") {
        return { ok: true, json: async () => ({ data: extracted, error: null }) } as Response;
      }
      return { ok: true, json: async () => ({ data: { status: "ok" }, error: null }) } as Response;
    }),
  );
  return calls;
}

beforeEach(() => {});
afterEach(() => vi.restoreAllMocks());

/** Advance past the quick-questions screen with its defaults. */
async function passQuick(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: /^next$/i }));
}

describe("<IntakeFlow /> — confirm-or-correct", () => {
  it("shows extracted values (not blank fields) and persists a correction", async () => {
    const calls = mockApi();
    const user = userEvent.setup();
    render(<IntakeFlow onComplete={vi.fn()} />);

    await passQuick(user);

    // confirm-or-correct renders the EXTRACTED value, not an empty field (§8.3)
    expect(await screen.findByText("Meridian Wealth")).toBeInTheDocument();
    expect(screen.getByText("2011")).toBeInTheDocument();

    // correct the firm name
    const firmRow = screen.getByText("Firm name").closest("div")!;
    await user.click(within(firmRow).getByRole("button", { name: /edit/i }));
    const input = screen.getByLabelText("Firm name");
    await user.clear(input);
    await user.type(input, "Meridian Wealth Partners");
    await user.click(screen.getByRole("button", { name: /looks right/i }));

    const correction = calls.find((c) => c.url === "/api/onboarding/intake" && c.method === "POST" && (c.body as { kind?: string }).kind === "corrections");
    expect(correction).toBeTruthy();
    expect((correction!.body as { corrections: { field: string; value: unknown }[] }).corrections).toContainEqual({
      field: "firmName",
      value: "Meridian Wealth Partners",
    });
  });
});

describe("<IntakeFlow /> — template pick + build", () => {
  it("selects a template, fires the build, and completes", async () => {
    const calls = mockApi();
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<IntakeFlow onComplete={onComplete} />);

    // quick → confirm → assets (skip) → round2 → template
    await passQuick(user);
    await user.click(await screen.findByRole("button", { name: /looks right/i }));
    await user.click(await screen.findByRole("button", { name: /skip|upload & continue/i }));
    await user.click(await screen.findByRole("button", { name: /^continue$/i }));

    // template screen: brand-colour preview + three cards
    expect(await screen.findByRole("heading", { name: /pick your template/i })).toBeInTheDocument();
    expect(screen.getByText(/#1F6F52/)).toBeInTheDocument();

    // build is disabled until a template is chosen
    const build = screen.getByRole("button", { name: /build my site/i });
    expect(build).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: /modern template/i }));
    expect(build).toBeEnabled();
    await user.click(build);

    // persisted the template, then fired the build; completed
    const templateCalls = calls.filter((c) => c.url === "/api/onboarding/template");
    expect(templateCalls[0].body).toEqual({ templateId: "modern" });
    expect(templateCalls[1].body).toEqual({ action: "build" });
    expect(onComplete).toHaveBeenCalled();
  });
});
