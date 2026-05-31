import { DASHBOARD_NAV } from "@/lib/dashboard/nav";

import { ComingSoon } from "./coming-soon";
import { PageHeader } from "./page-header";

/**
 * Renders a full not-yet-built tab (header + coming-soon body) from its nav key,
 * so each route file stays a one-liner and the copy lives in one place.
 */
const STUB_COPY: Record<string, { lead: string; body: string }> = {
  edit: {
    lead: "Change your live site by chatting with WRI.",
    body: "Edit Site is where you'll request copy and design changes in plain English — every change re-runs compliance validation before it publishes.",
  },
  assets: {
    lead: "Manage your logo, photos, and documents.",
    body: "Upload and replace the images and documents used across your site, with a confirmation step before anything goes live.",
  },
  team: {
    lead: "Add and edit the people on your site.",
    body: "A structured editor for team members — names, titles, designations, and bios — that flows through the same compliance and deploy pipeline as every other change.",
  },
  leads: {
    lead: "Every contact-form inquiry, in one inbox.",
    body: "Leads captured by your site's contact form will land here with name, email, and message, plus CSV export.",
  },
  blog: {
    lead: "Publish market commentary and insights.",
    body: "Upload Markdown posts; each runs an automatic compliance check before it can publish (up to two per month).",
  },
  billing: {
    lead: "Manage your subscription and invoices.",
    body: "Your plan, payment method, next billing date, and invoices — managed through Stripe.",
  },
  settings: {
    lead: "Account, notifications, and domain.",
    body: "Email and password, notification preferences, custom-domain settings, and account deletion — arriving in the next slice of this ticket.",
  },
};

export function StubTab({ navKey }: { navKey: keyof typeof STUB_COPY }) {
  const item = DASHBOARD_NAV.find((i) => i.key === navKey);
  const copy = STUB_COPY[navKey];
  if (!item || !copy) return null;

  return (
    <>
      <PageHeader title={item.label} description={copy.lead} />
      <ComingSoon icon={item.icon} title={item.label} description={copy.body} />
    </>
  );
}
