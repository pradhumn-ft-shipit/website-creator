/**
 * The email template registry (PRD §9.4). This is the ONLY place any email
 * body lives — every caller (003 verify, 024 launch/dns, 028 lead, 032
 * cancellation/payment) passes a template name + typed `data`, never HTML.
 *
 * One shared `Layout` (react-email primitives) wraps every template so all
 * WRI emails look consistent; each template is a small pure component that
 * only renders its content into that shell. Bodies are deliberately stubs
 * (§4.5/§4.6/etc real copy) — real copy lands with the ticket that sends it
 * (003 already sends verification via Supabase's own emailer; 024/028/032
 * wire these up when they land).
 */
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";
import type { ReactElement, ReactNode } from "react";

// ---- shared layout ---------------------------------------------------------

function Layout({
  preview,
  children,
}: {
  preview: string;
  children: ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#f6f5f2", fontFamily: "sans-serif" }}>
        <Container
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 12,
            padding: "32px",
            margin: "24px auto",
            maxWidth: 480,
          }}
        >
          <Heading as="h2" style={{ color: "#1b4332" }}>
            WRI
          </Heading>
          {children}
          <Hr />
          <Text style={{ color: "#6b7280", fontSize: 12 }}>
            Website for Regulatory Industries · WRI, Inc.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// ---- template data contracts ------------------------------------------------

export interface VerifyEmailData {
  verifyUrl: string;
}

export interface LaunchData {
  firmName: string;
  siteUrl: string;
  dnsInstructionsUrl: string;
  mxWarning: boolean;
  calComUrl?: string;
}

export interface LeadData {
  firmName: string;
  leadName: string;
  leadEmail: string;
  leadPhone?: string;
  leadMessage?: string;
  sourcePage?: string;
}

export interface DnsSuccessData {
  firmName: string;
  siteUrl: string;
}

export interface CancellationData {
  firmName: string;
  effectiveDate: string;
}

export interface PaymentFailedData {
  firmName: string;
  retryUrl?: string;
  graceEndsDate?: string;
}

/** Every template name every caller may send (§9.4 registry keys). */
export type TemplateName =
  | "verify_email"
  | "launch"
  | "lead"
  | "dns_success"
  | "cancellation_day0"
  | "cancellation_day14"
  | "cancellation_day28"
  | "payment_failed";

/** The `data` shape required for each template name. */
export interface TemplateDataMap {
  verify_email: VerifyEmailData;
  launch: LaunchData;
  lead: LeadData;
  dns_success: DnsSuccessData;
  cancellation_day0: CancellationData;
  cancellation_day14: CancellationData;
  cancellation_day28: CancellationData;
  payment_failed: PaymentFailedData;
}

export interface TemplateDefinition<D> {
  subject(data: D): string;
  render(data: D): ReactElement;
}

// ---- template bodies (stub copy — real copy lands with the consuming ticket) --

const verifyEmail: TemplateDefinition<VerifyEmailData> = {
  subject: () => "Verify your WRI account",
  render: (data) => (
    <Layout preview="Verify your email to finish setting up your WRI site.">
      <Text>Thanks for signing up. Confirm your email to continue.</Text>
      <Link href={data.verifyUrl}>Verify email</Link>
    </Layout>
  ),
};

const launch: TemplateDefinition<LaunchData> = {
  subject: (data) => `${data.firmName}, your WRI site is live`,
  render: (data) => (
    <Layout preview="Your new website is live.">
      <Text>Your site is live at:</Text>
      <Link href={data.siteUrl}>{data.siteUrl}</Link>
      <Text>
        Point your domain here next: <Link href={data.dnsInstructionsUrl}>DNS instructions</Link>.
      </Text>
      {data.mxWarning ? (
        <Text style={{ color: "#b91c1c", fontWeight: "bold", border: "1px solid #b91c1c", padding: 8 }}>
          Heads up — follow the DNS instructions carefully so your existing email keeps working.
        </Text>
      ) : (
        <Text>Your email will not be affected by this change.</Text>
      )}
      {data.calComUrl ? (
        <Text>
          Want a hand? <Link href={data.calComUrl}>Book time with us</Link>.
        </Text>
      ) : null}
    </Layout>
  ),
};

const lead: TemplateDefinition<LeadData> = {
  subject: (data) => `New lead: ${data.leadName}`,
  render: (data) => (
    <Layout preview={`New lead from your site: ${data.leadName}`}>
      <Text>You have a new lead on {data.firmName}&apos;s site:</Text>
      <Text>Name: {data.leadName}</Text>
      <Text>Email: {data.leadEmail}</Text>
      {data.leadPhone ? <Text>Phone: {data.leadPhone}</Text> : null}
      {data.sourcePage ? <Text>From: {data.sourcePage}</Text> : null}
      {data.leadMessage ? <Text>Message: {data.leadMessage}</Text> : null}
      <Text>Reply to this email to respond directly to the lead.</Text>
    </Layout>
  ),
};

const dnsSuccess: TemplateDefinition<DnsSuccessData> = {
  subject: () => "Your custom domain is live",
  render: (data) => (
    <Layout preview="Your custom domain is verified and live.">
      <Text>Your custom domain is verified and pointed at your WRI site:</Text>
      <Link href={data.siteUrl}>{data.siteUrl}</Link>
    </Layout>
  ),
};

function cancellationTemplate(day: 0 | 14 | 28): TemplateDefinition<CancellationData> {
  return {
    subject: (data) => `Your WRI subscription is ending on ${data.effectiveDate}`,
    render: (data) => (
      <Layout preview="Your WRI subscription is scheduled to end.">
        <Text>
          Hi {data.firmName}, this is a reminder that your subscription is scheduled to end on{" "}
          {data.effectiveDate}
          {day === 0 ? " (today)" : ` (in ${28 - day} days)`}.
        </Text>
        <Text>Reactivate any time before then to keep your site live.</Text>
      </Layout>
    ),
  };
}

const paymentFailed: TemplateDefinition<PaymentFailedData> = {
  subject: () => "Your WRI payment didn't go through",
  render: (data) => (
    <Layout preview="We couldn't process your last payment.">
      <Text>Hi {data.firmName}, we couldn&apos;t process your last payment.</Text>
      {data.retryUrl ? <Link href={data.retryUrl}>Update your payment method</Link> : null}
      {data.graceEndsDate ? (
        <Text>Your site stays live until {data.graceEndsDate} while we retry.</Text>
      ) : null}
    </Layout>
  ),
};

/**
 * The registry — the single source every `sendEmail()` call resolves against.
 * Adding a template = adding one entry here; no other module knows about copy.
 */
export const TEMPLATES: { [K in TemplateName]: TemplateDefinition<TemplateDataMap[K]> } = {
  verify_email: verifyEmail,
  launch,
  lead,
  dns_success: dnsSuccess,
  cancellation_day0: cancellationTemplate(0),
  cancellation_day14: cancellationTemplate(14),
  cancellation_day28: cancellationTemplate(28),
  payment_failed: paymentFailed,
};

export function resolveTemplate<K extends TemplateName>(name: K): TemplateDefinition<TemplateDataMap[K]> {
  return TEMPLATES[name];
}
