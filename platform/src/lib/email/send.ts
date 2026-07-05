/**
 * `sendEmail()` — the single deep entry point every later feature (024 launch/
 * dns, 028 lead, 032 cancellation/payment, 003 verify) calls to send an email
 * (PRD §9.4, §4.5). Resolves the named template against typed `data`, sends via
 * Resend, and writes the `email_log` audit row.
 *
 * Deps (`resend` client + service-role Supabase client) are injected so the
 * logic is unit-testable against a mocked boundary — same
 * inject-deps-then-provide-a-wired-entry-point pattern as
 * `lib/admin/orders.ts#retryOrder` / `retryOrderById`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database.types";

import { EmailClient, resendClient } from "./client";
import { writeEmailLog } from "./log";
import { resolveTemplate, type TemplateDataMap, type TemplateName } from "./templates";

type AdminClient = SupabaseClient<Database>;

export interface SendEmailInput<K extends TemplateName = TemplateName> {
  template: K;
  to: string;
  data: TemplateDataMap[K];
  /** Per-send Reply-To override (§4.5 — lead notifications reply to the lead). */
  replyTo?: string;
  /** Attaches the audit row to an account, when one applies. */
  accountId?: string | null;
}

export interface SendEmailResult {
  /** The Resend message id. */
  messageId: string;
  /** The `email_log` row id. */
  logId: string;
}

export type SendEmailDeps = {
  resend: EmailClient;
  client: AdminClient;
};

/**
 * The testable core: resolve the template, send, log. No env reads, no
 * singletons — pass in a stub `EmailClient`/Supabase client from a test.
 */
export async function sendEmailWithDeps<K extends TemplateName>(
  deps: SendEmailDeps,
  input: SendEmailInput<K>,
): Promise<SendEmailResult> {
  const template = resolveTemplate(input.template);
  const result = await deps.resend.send({
    to: input.to,
    subject: template.subject(input.data),
    react: template.render(input.data),
    replyTo: input.replyTo,
  });

  const logged = await writeEmailLog(deps.client, {
    accountId: input.accountId ?? null,
    template: input.template,
    recipient: input.to,
    resendMessageId: result.id,
  });

  return { messageId: result.id, logId: logged.id };
}

/** The real, env-wired entry point every caller should reach for. */
export function sendEmail<K extends TemplateName>(
  input: SendEmailInput<K>,
): Promise<SendEmailResult> {
  return sendEmailWithDeps({ resend: resendClient(), client: createAdminClient() }, input);
}
