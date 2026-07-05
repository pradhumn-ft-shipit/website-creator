/**
 * Public surface of the email module — the only entry point later tickets
 * (003, 024, 028, 032) import. Resend/template/log internals stay internal.
 */

export { sendEmail, sendEmailWithDeps, type SendEmailDeps, type SendEmailInput, type SendEmailResult } from "./send";
export { EmailClient, resendClient, DEFAULT_FROM, type SendArgs, type SendResult, type ResendBoundary } from "./client";
export {
  TEMPLATES,
  resolveTemplate,
  type TemplateName,
  type TemplateDataMap,
  type TemplateDefinition,
} from "./templates";
export { writeEmailLog, updateEmailLogStatus, type EmailLogStatus } from "./log";
export {
  verifyWebhookSignature,
  applyEmailStatusEvent,
  type ResendWebhookEvent,
  type ApplyEventResult,
  type WebhookSignatureHeaders,
} from "./webhook";
export { EmailRateLimitError, EmailSendError } from "./errors";
