import { describe, expect, it } from "vitest";

import {
  buildSiteOverview,
  deriveDomainStatus,
  ensureHttps,
  TEMPLATE_LABELS,
} from "./overview";

describe("deriveDomainStatus", () => {
  it("is not_configured when no custom domain is set", () => {
    expect(
      deriveDomainStatus({ custom_domain: null, custom_domain_verified_at: null }),
    ).toBe("not_configured");
  });

  it("is pending when a custom domain is set but not yet verified", () => {
    expect(
      deriveDomainStatus({
        custom_domain: "advisor.com",
        custom_domain_verified_at: null,
      }),
    ).toBe("pending");
  });

  it("is verified once custom_domain_verified_at is present", () => {
    expect(
      deriveDomainStatus({
        custom_domain: "advisor.com",
        custom_domain_verified_at: "2026-05-31T00:00:00Z",
      }),
    ).toBe("verified");
  });
});

describe("ensureHttps", () => {
  it("prepends https:// to a bare host", () => {
    expect(ensureHttps("advisor.com")).toBe("https://advisor.com");
  });

  it("leaves an absolute https URL untouched", () => {
    expect(ensureHttps("https://x.vercel.app")).toBe("https://x.vercel.app");
  });

  it("leaves an absolute http URL untouched", () => {
    expect(ensureHttps("http://x.local")).toBe("http://x.local");
  });
});

describe("buildSiteOverview", () => {
  const base = {
    template_id: "trust",
    vercel_default_url: "https://acme.vercel.app",
    custom_domain: null,
    custom_domain_verified_at: null,
    last_deployed_at: "2026-05-30T12:00:00Z",
  };

  it("maps the template id to its display label", () => {
    expect(buildSiteOverview(base).templateLabel).toBe(TEMPLATE_LABELS.trust);
    expect(buildSiteOverview(base).templateId).toBe("trust");
  });

  it("returns a null template label for an unknown/empty template", () => {
    const o = buildSiteOverview({ ...base, template_id: null });
    expect(o.templateId).toBeNull();
    expect(o.templateLabel).toBeNull();
  });

  it("falls back to the subdomain URL while the custom domain is unverified", () => {
    const o = buildSiteOverview({
      ...base,
      custom_domain: "advisor.com",
      custom_domain_verified_at: null,
    });
    expect(o.domainStatus).toBe("pending");
    expect(o.liveUrl).toBe("https://acme.vercel.app");
  });

  it("prefers the verified custom domain for the live URL", () => {
    const o = buildSiteOverview({
      ...base,
      custom_domain: "advisor.com",
      custom_domain_verified_at: "2026-05-31T00:00:00Z",
    });
    expect(o.domainStatus).toBe("verified");
    expect(o.liveUrl).toBe("https://advisor.com");
  });

  it("has a null live URL before the first deploy sets a subdomain", () => {
    const o = buildSiteOverview({ ...base, vercel_default_url: null });
    expect(o.subdomainUrl).toBeNull();
    expect(o.liveUrl).toBeNull();
  });
});
