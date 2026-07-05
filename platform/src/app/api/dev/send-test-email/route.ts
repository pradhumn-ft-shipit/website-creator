/**
 * Dev-gated Resend smoke check (§9.4 verify path). Sends one real email via
 * `sendEmail()` and returns the Resend message id + `email_log` row id via the
 * `{data,error}` envelope — proof the client, template registry, Reply-To
 * override, and log write are wired correctly end to end.
 *
 * Hard-disabled outside development (404 via AppError), same posture as
 * `/api/dev/gemini-check`. Requires `RESEND_API_KEY`; without it `sendEmail()`
 * throws and the envelope surfaces an opaque 500.
 *
 *   POST /api/dev/send-test-email
 *   body (all optional): { to?: string; template?: TemplateName; replyTo?: string }
 */
import { apiHandler, AppError } from "@/lib/api/envelope";
import { sendEmail, type TemplateDataMap, type TemplateName } from "@/lib/email";

const DEFAULT_TEST_RECIPIENT = "delivered@resend.dev"; // Resend's sandbox test address

/** Minimal, always-valid stub data per template — enough to render + send. */
const STUB_DATA: TemplateDataMap = {
  verify_email: { verifyUrl: "https://wri.com/verify?token=dev-test" },
  launch: {
    firmName: "Test Advisory",
    siteUrl: "https://test-advisory.wri.com",
    dnsInstructionsUrl: "https://wri.com/help/dns",
    mxWarning: false,
    calComUrl: "https://cal.com/wri",
  },
  lead: {
    firmName: "Test Advisory",
    leadName: "Jane Prospect",
    leadEmail: "jane@example.com",
  },
  dns_success: { firmName: "Test Advisory", siteUrl: "https://test-advisory.com" },
  cancellation_day0: { firmName: "Test Advisory", effectiveDate: "2026-08-01" },
  cancellation_day14: { firmName: "Test Advisory", effectiveDate: "2026-08-01" },
  cancellation_day28: { firmName: "Test Advisory", effectiveDate: "2026-08-01" },
  payment_failed: { firmName: "Test Advisory", retryUrl: "https://wri.com/billing" },
};

interface RequestBody {
  to?: string;
  template?: TemplateName;
  replyTo?: string;
}

export const POST = apiHandler(async (request) => {
  if (process.env.NODE_ENV === "production") {
    throw new AppError("Not found.", "not_found", 404);
  }

  const body: RequestBody = await request.json().catch(() => ({}));
  const template = body.template ?? "verify_email";
  if (!(template in STUB_DATA)) {
    throw new AppError(`Unknown template "${template}".`, "unknown_template", 400);
  }

  const result = await sendEmail({
    template,
    to: body.to ?? DEFAULT_TEST_RECIPIENT,
    data: STUB_DATA[template],
    replyTo: body.replyTo,
  });

  return { template, to: body.to ?? DEFAULT_TEST_RECIPIENT, ...result };
});
