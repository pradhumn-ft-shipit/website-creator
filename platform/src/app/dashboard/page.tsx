import type { Metadata } from "next";

import { FormMessage } from "@/components/auth/form-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { SiteOverviewView } from "@/components/dashboard/site-overview";
import { getSiteOverview } from "@/lib/dashboard/overview";

export const metadata: Metadata = { title: "Site Overview · WRI" };

/**
 * Site Overview — the dashboard landing tab (PRD §12.2). Fetches the advisor's
 * site (or null = not-live empty state); a thrown DB error escalates to the
 * dashboard error boundary (§7.6). Arriving with ?verified=1 (post email
 * confirmation) shows the verified-success banner.
 */
export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string }>;
}) {
  const { verified } = await searchParams;
  const overview = await getSiteOverview();

  return (
    <>
      <PageHeader
        title="Site Overview"
        description="Your website's address, custom domain, and deployment status."
      />

      {verified ? (
        <FormMessage tone="success">
          Your email is verified — your account is ready.
        </FormMessage>
      ) : null}

      <SiteOverviewView overview={overview} />
    </>
  );
}
