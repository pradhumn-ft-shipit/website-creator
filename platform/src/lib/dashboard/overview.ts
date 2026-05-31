import { createClient } from "@/lib/supabase/server";

/**
 * Site Overview data layer (PRD §12.2). Reads the signed-in advisor's single
 * site (one account = one site in v1) and shapes it for the overview tab.
 * Returns null when no site row exists yet — i.e. the advisor has signed up but
 * the build pipeline hasn't created a site (the designed empty state). All the
 * derivation here is pure and unit-tested; only `getSiteOverview` touches IO.
 */

export type DomainStatus = "not_configured" | "pending" | "verified";

export type TemplateId = "trust" | "modern" | "boutique";

export const TEMPLATE_LABELS: Record<TemplateId, string> = {
  trust: "Trust",
  modern: "Modern",
  boutique: "Boutique",
};

function isTemplateId(value: string | null): value is TemplateId {
  return value === "trust" || value === "modern" || value === "boutique";
}

/** Prepend https:// unless the value already carries a scheme. */
export function ensureHttps(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

type SiteRow = {
  template_id: string | null;
  vercel_default_url: string | null;
  custom_domain: string | null;
  custom_domain_verified_at: string | null;
  last_deployed_at: string | null;
};

/**
 * Domain status drives the badge on the overview (PRD §12.2): no domain →
 * Not configured; domain set but unverified → Pending; verified timestamp → Verified.
 */
export function deriveDomainStatus(
  site: Pick<SiteRow, "custom_domain" | "custom_domain_verified_at">,
): DomainStatus {
  if (!site.custom_domain) return "not_configured";
  if (!site.custom_domain_verified_at) return "pending";
  return "verified";
}

export type SiteOverview = {
  /** Always-available Vercel subdomain (null until the first deploy). */
  subdomainUrl: string | null;
  customDomain: string | null;
  domainStatus: DomainStatus;
  lastDeployedAt: string | null;
  templateId: TemplateId | null;
  templateLabel: string | null;
  /** Best public URL: verified custom domain, else the subdomain (else null). */
  liveUrl: string | null;
};

export function buildSiteOverview(site: SiteRow): SiteOverview {
  const domainStatus = deriveDomainStatus(site);
  const templateId = isTemplateId(site.template_id) ? site.template_id : null;
  const subdomainUrl = site.vercel_default_url
    ? ensureHttps(site.vercel_default_url)
    : null;
  const liveUrl =
    domainStatus === "verified" && site.custom_domain
      ? ensureHttps(site.custom_domain)
      : subdomainUrl;

  return {
    subdomainUrl,
    customDomain: site.custom_domain,
    domainStatus,
    lastDeployedAt: site.last_deployed_at,
    templateId,
    templateLabel: templateId ? TEMPLATE_LABELS[templateId] : null,
    liveUrl,
  };
}

/** Resolve the current advisor's Site Overview, or null if no site exists yet. */
export async function getSiteOverview(): Promise<SiteOverview | null> {
  const supabase = await createClient();
  // RLS scopes this to the signed-in user's own account/site.
  const { data, error } = await supabase
    .from("sites")
    .select(
      "template_id, vercel_default_url, custom_domain, custom_domain_verified_at, last_deployed_at",
    )
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return buildSiteOverview(data as SiteRow);
}
