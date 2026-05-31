import {
  ExternalLink,
  Globe,
  LayoutTemplate,
  Rocket,
  Clock,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ensureHttps, type SiteOverview } from "@/lib/dashboard/overview";

const DOMAIN_STATUS: Record<
  SiteOverview["domainStatus"],
  { label: string; variant: "neutral" | "warning" | "success" }
> = {
  not_configured: { label: "Not configured", variant: "neutral" },
  pending: { label: "Pending verification", variant: "warning" },
  verified: { label: "Verified", variant: "success" },
};

function formatDeployedAt(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function StatCard({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Globe;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-xl border p-5 shadow-sm">
      <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
        <Icon className="size-4" aria-hidden />
        {label}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

/**
 * Site Overview tab body (PRD §12.2). `overview === null` means no site exists
 * yet (signed up, not yet built) — the designed empty state. Otherwise: live
 * address, domain status, last deploy, and template, with a "Visit live site"
 * action. Pure presentational — all derivation happens in `buildSiteOverview`.
 */
export function SiteOverviewView({
  overview,
}: {
  overview: SiteOverview | null;
}) {
  if (!overview) {
    return (
      <div className="bg-card/40 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed px-6 py-20 text-center">
        <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-xl">
          <Rocket className="size-5" aria-hidden />
        </span>
        <h2 className="mt-5 text-base font-semibold">
          Your website isn&apos;t live yet
        </h2>
        <p className="text-muted-foreground mt-2 max-w-md text-sm">
          Once you finish onboarding and we build your site, its address,
          deployment status, and custom-domain setup will appear here. We&apos;ll
          email you the moment it goes live.
        </p>
      </div>
    );
  }

  const domain = DOMAIN_STATUS[overview.domainStatus];

  return (
    <div className="flex flex-col gap-6">
      {/* Live site banner */}
      <div className="bg-card rounded-xl border p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Your site
            </p>
            {overview.liveUrl ? (
              <a
                href={overview.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block truncate text-lg font-semibold tracking-tight hover:underline"
              >
                {overview.liveUrl.replace(/^https?:\/\//, "")}
              </a>
            ) : (
              <p className="mt-1 text-lg font-semibold tracking-tight">
                Preparing your address…
              </p>
            )}
          </div>
          {overview.liveUrl ? (
            <Button asChild className="shrink-0">
              <a
                href={overview.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink aria-hidden />
                Visit live site
              </a>
            </Button>
          ) : (
            <Button disabled className="shrink-0">
              <ExternalLink aria-hidden />
              Visit live site
            </Button>
          )}
        </div>
      </div>

      {/* Detail cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={Globe} label="Custom domain">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium">
              {overview.customDomain ?? "—"}
            </span>
            <Badge variant={domain.variant}>{domain.label}</Badge>
          </div>
          {overview.domainStatus === "not_configured" ? (
            <p className="text-muted-foreground mt-2 text-xs">
              Connect your own domain in Settings to replace the default address.
            </p>
          ) : overview.domainStatus === "pending" ? (
            <p className="text-muted-foreground mt-2 text-xs">
              Add the DNS records we emailed you; verification can take up to 48
              hours.
            </p>
          ) : null}
        </StatCard>

        <StatCard icon={LayoutTemplate} label="Template">
          <span className="text-sm font-medium">
            {overview.templateLabel ?? "—"}
          </span>
        </StatCard>

        <StatCard icon={Clock} label="Last deployed">
          <span className="text-sm font-medium">
            {overview.lastDeployedAt
              ? formatDeployedAt(overview.lastDeployedAt)
              : "Not deployed yet"}
          </span>
        </StatCard>

        {overview.subdomainUrl ? (
          <StatCard icon={ExternalLink} label="Default address">
            <a
              href={ensureHttps(overview.subdomainUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium break-all hover:underline"
            >
              {overview.subdomainUrl.replace(/^https?:\/\//, "")}
            </a>
          </StatCard>
        ) : null}
      </div>
    </div>
  );
}
