import { describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import TermsOfServicePage from "./terms/page";
import PrivacyPolicyPage from "./privacy/page";
import DpaPage from "./dpa/page";
import LegalIndexPage from "./page";
import {
  DPA_TEMPLATE,
  LEGAL_REVIEW_PENDING,
  PRIVACY_POLICY,
  TERMS_OF_SERVICE,
} from "@/lib/legal/content";

describe("platform legal pages (037)", () => {
  it("renders the Terms of Service with the indemnification clause (§14.3)", () => {
    render(<TermsOfServicePage />);
    expect(
      screen.getByRole("heading", { level: 1, name: TERMS_OF_SERVICE.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /indemnification and limitation of liability/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/not liable for compliance violations/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /data processing agreement/i }),
    ).toBeInTheDocument();
  });

  it("renders the Privacy Policy with controller/processor split, CCPA rights, and the processor list (§14.5/§14.6)", () => {
    render(<PrivacyPolicyPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: PRIVACY_POLICY.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(/WRI is the data controller/i)).toBeInTheDocument();
    expect(screen.getByText(/WRI is a data processor/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /CCPA \/ CPRA/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Vercel:", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Supabase:", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Resend:", { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/Gemini API/i)).toBeInTheDocument();
  });

  it("renders the DPA template and marks it as incorporated into the ToS by default", () => {
    render(<DpaPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: DPA_TEMPLATE.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/applies automatically to every WRI account/i),
    ).toBeInTheDocument();
  });

  it("marks every legal page as pending counsel review while LEGAL_REVIEW_PENDING is true", () => {
    expect(LEGAL_REVIEW_PENDING).toBe(true);

    render(<TermsOfServicePage />);
    expect(screen.getByTestId("legal-review-pending-banner")).toHaveTextContent(
      /pending counsel review/i,
    );
    cleanup();

    render(<PrivacyPolicyPage />);
    expect(screen.getByTestId("legal-review-pending-banner")).toHaveTextContent(
      /pending counsel review/i,
    );
    cleanup();

    render(<DpaPage />);
    expect(screen.getByTestId("legal-review-pending-banner")).toHaveTextContent(
      /pending counsel review/i,
    );
  });

  it("cross-links all three documents from each page", () => {
    render(<TermsOfServicePage />);
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute(
      "href",
      "/legal/privacy",
    );
    expect(screen.getByRole("link", { name: "DPA" })).toHaveAttribute(
      "href",
      "/legal/dpa",
    );
  });

  it("links from the legal index to each document route", () => {
    render(<LegalIndexPage />);
    const hrefs = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(
      expect.arrayContaining(["/legal/terms", "/legal/privacy", "/legal/dpa"]),
    );
  });
});
