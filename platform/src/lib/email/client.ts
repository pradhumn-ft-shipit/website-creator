/**
 * EmailClient — the one place the Resend SDK is touched (PRD §9.4). Follows the
 * Gemini/Firecrawl client pattern: a thin structural SDK boundary is injected so
 * unit tests pass a stub and there is no live call; `resendClient()` wires the
 * real `resend` package + env key.
 *
 * From `noreply@wri.com` by default; callers may override `replyTo` per send
 * (§4.5 — lead notifications reply straight to the lead).
 */

import type { ReactElement } from "react";
import { Resend } from "resend";

import { EmailRateLimitError, EmailSendError } from "./errors";

/** The sender address every email sends from unless a call overrides it. */
export const DEFAULT_FROM = "WRI <noreply@wri.com>";

export interface SendArgs {
  from?: string;
  to: string;
  subject: string;
  /** A React element (react-email components) — Resend renders it to HTML. */
  react: ReactElement;
  replyTo?: string;
}

export interface SendResult {
  /** The Resend message id, persisted onto `email_log.resend_message_id`. */
  id: string;
}

/** Minimal structural slice of the `resend` SDK this client depends on. */
export interface ResendBoundary {
  emails: {
    send(args: {
      from: string;
      to: string | string[];
      subject: string;
      react: ReactElement;
      replyTo?: string;
    }): Promise<{
      data: { id: string } | null;
      error: { message: string; name?: string; statusCode?: number } | null;
    }>;
  };
}

function isRateLimited(error: { name?: string; statusCode?: number } | null): boolean {
  if (!error) return false;
  if (error.statusCode === 429) return true;
  return error.name === "rate_limit_exceeded";
}

export class EmailClient {
  constructor(private readonly sdk: ResendBoundary) {}

  async send(args: SendArgs): Promise<SendResult> {
    let res;
    try {
      res = await this.sdk.emails.send({
        from: args.from ?? DEFAULT_FROM,
        to: args.to,
        subject: args.subject,
        react: args.react,
        replyTo: args.replyTo,
      });
    } catch (err) {
      throw new EmailSendError("Resend request failed.", "email_send_failed", { cause: err });
    }

    if (isRateLimited(res.error)) {
      throw new EmailRateLimitError("resend.emails.send", { cause: res.error });
    }
    if (res.error || !res.data) {
      throw new EmailSendError(
        res.error?.message ?? "Resend returned no message id.",
        "email_send_failed",
        { cause: res.error ?? undefined },
      );
    }
    return { id: res.data.id };
  }
}

let singleton: EmailClient | undefined;

/**
 * The real, env-wired client. Reads `RESEND_API_KEY`. Throws if missing so
 * misconfiguration fails fast rather than at the first live send (same posture
 * as `geminiClient()` / `firecrawlClient()`). Memoised.
 */
export function resendClient(): EmailClient {
  if (singleton) return singleton;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not set. Add it to .env.local (ticket 004) — the Resend " +
        "dev sandbox key works before a domain is verified.",
    );
  }
  // The real Resend instance satisfies ResendBoundary structurally.
  singleton = new EmailClient(new Resend(apiKey) as unknown as ResendBoundary);
  return singleton;
}
