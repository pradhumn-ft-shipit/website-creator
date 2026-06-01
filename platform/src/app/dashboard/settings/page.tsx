import type { Metadata } from "next";
import { Globe } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { SettingsForm } from "@/components/dashboard/settings/settings-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAccountSettings } from "@/lib/account/service";
import { getSiteOverview, type SiteOverview } from "@/lib/dashboard/overview";

export const metadata: Metadata = { title: "Settings · WRI" };

const DOMAIN_STATUS: Record<
  SiteOverview["domainStatus"],
  { label: string; variant: "neutral" | "warning" | "success"; help: string }
> = {
  not_configured: {
    label: "Not configured",
    variant: "neutral",
    help: "No custom domain yet. Your site is reachable at its default address; connect a domain during onboarding to use your own.",
  },
  pending: {
    label: "Pending verification",
    variant: "warning",
    help: "Add the DNS records we emailed you at your registrar. We re-check automatically — verification can take up to 48 hours.",
  },
  verified: {
    label: "Verified",
    variant: "success",
    help: "Your custom domain is live and pointing at your site.",
  },
};

/**
 * Settings tab (PRD §12.9). Profile / email / password / notifications / account
 * deletion are interactive (SettingsForm). Domain status is read-only here — the
 * advisor manages DNS at their registrar and verification re-runs automatically
 * (ticket 025), so there's no button to fake.
 */
export default async function SettingsPage() {
  const [settings, overview] = await Promise.all([
    getAccountSettings(),
    getSiteOverview(),
  ]);

  const domain = overview ? DOMAIN_STATUS[overview.domainStatus] : null;

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your profile, sign-in, notifications, domain, and account."
      />

      <div className="flex flex-col gap-8">
        <SettingsForm settings={settings} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="text-muted-foreground size-4" aria-hidden />
              Custom domain
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {overview && domain ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-medium">
                    {overview.customDomain ?? "No custom domain"}
                  </span>
                  <Badge variant={domain.variant}>{domain.label}</Badge>
                </div>
                <p className="text-muted-foreground text-sm">{domain.help}</p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Your site isn&apos;t live yet. Domain settings will appear here
                once it&apos;s built and deployed.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
