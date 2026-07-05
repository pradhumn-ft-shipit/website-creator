import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const postJson = vi.fn();
vi.mock("@/lib/api/client", () => ({ postJson: (...args: unknown[]) => postJson(...args) }));

import { ComplianceConsole } from "./compliance-console";
import type { DraftSummary } from "@/lib/admin/compliance/drafts";
import type { RulesetVersionRow } from "@/lib/admin/compliance/versions";
import type { ApprovalCheck } from "@/lib/admin/compliance/publish";

afterEach(() => {
  postJson.mockReset();
  refresh.mockReset();
});

const version = (over: Partial<RulesetVersionRow> = {}): RulesetVersionRow => ({
  industry: "ria",
  version: "1.0",
  versionString: "ria/v1.0",
  status: "approved",
  approved: true,
  reviewers: ["a@wri.com", "b@wri.com"],
  published: true,
  publishedAt: "2026-06-01T00:00:00Z",
  affectedSiteCount: 12,
  ...over,
});

const approval = (ok: boolean, reasons: string[] = []): ApprovalCheck => ({ ok, signers: [], reasons });

const draft = (over: Partial<DraftSummary> = {}): DraftSummary => ({
  id: "draft-1",
  industry: "ria",
  subIndustry: null,
  baseVersion: "1.0",
  targetVersion: "1.1",
  status: "in_review",
  reviews: [],
  approval: approval(false, ["A drafter must sign off. An approver must sign off."]),
  hasResearch: true,
  createdAt: "2026-07-05T00:00:00Z",
  updatedAt: "2026-07-05T00:00:00Z",
  ...over,
});

describe("ComplianceConsole", () => {
  it("shows each version with its live-sites-affected count", () => {
    render(<ComplianceConsole versions={[version()]} drafts={[]} />);
    expect(screen.getByTestId("version-1.0")).toBeInTheDocument();
    expect(screen.getByTestId("affected-1.0")).toHaveTextContent("12");
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("triggers the research agent and renders the cited proposal", async () => {
    postJson.mockResolvedValue({
      data: {
        proposal: {
          industry: "ria",
          baseVersion: "1.0",
          generatedAt: "2026-07-05T00:00:00Z",
          summary: "One change found.",
          changes: [
            {
              category: "prohibitedContent",
              action: "add",
              summary: "Flag hypothetical performance.",
              citations: [{ title: "Marketing Rule", url: "https://www.sec.gov/marketing", source: "SEC.gov", quote: "..." }],
            },
          ],
          sources: [],
        },
      },
      error: null,
    });
    render(<ComplianceConsole versions={[version()]} drafts={[]} />);

    await userEvent.click(screen.getByTestId("run-research"));

    expect(postJson).toHaveBeenCalledWith("/api/admin/compliance/research", {});
    const proposal = await screen.findByTestId("proposal");
    expect(within(proposal).getByText("One change found.")).toBeInTheDocument();
    expect(within(proposal).getByText(/Flag hypothetical performance/)).toBeInTheDocument();
    expect(within(proposal).getByRole("link", { name: /SEC.gov/ })).toHaveAttribute("href", "https://www.sec.gov/marketing");
  });

  it("blocks Publish until the two-person gate is met, and posts to publish once it is", async () => {
    // Under-reviewed draft: Publish is disabled and the reason is shown.
    const { rerender } = render(
      <ComplianceConsole versions={[version()]} drafts={[draft()]} />,
    );
    const blockedPublish = screen.getByTestId("publish-draft-1");
    expect(blockedPublish).toBeDisabled();
    expect(screen.getByText(/must sign off/i)).toBeInTheDocument();

    // Fully-approved draft: Publish is enabled and posts to the publish route.
    postJson.mockResolvedValue({ data: { versionString: "ria/v1.1" }, error: null });
    rerender(
      <ComplianceConsole
        versions={[version()]}
        drafts={[draft({ approval: approval(true) })]}
      />,
    );
    const readyPublish = screen.getByTestId("publish-draft-1");
    expect(readyPublish).toBeEnabled();
    await userEvent.click(readyPublish);
    expect(postJson).toHaveBeenCalledWith("/api/admin/compliance/drafts/draft-1/publish", {});
    expect(refresh).toHaveBeenCalled();
  });

  it("records a drafter sign-off via the review route", async () => {
    postJson.mockResolvedValue({ data: { draft: {} }, error: null });
    render(<ComplianceConsole versions={[version()]} drafts={[draft()]} />);
    await userEvent.click(screen.getByRole("button", { name: /sign off as drafter/i }));
    expect(postJson).toHaveBeenCalledWith("/api/admin/compliance/drafts/draft-1/review", { role: "drafter" });
  });
});
