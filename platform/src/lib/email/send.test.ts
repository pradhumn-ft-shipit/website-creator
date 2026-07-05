import { describe, expect, it, vi } from "vitest";

const { writeEmailLog } = vi.hoisted(() => ({ writeEmailLog: vi.fn() }));
vi.mock("./log", () => ({ writeEmailLog }));

import type { EmailClient } from "./client";
import { sendEmailWithDeps } from "./send";

function stubResend(overrides: Partial<EmailClient> = {}): EmailClient {
  return {
    send: vi.fn().mockResolvedValue({ id: "msg-1" }),
    ...overrides,
  } as unknown as EmailClient;
}

describe("sendEmailWithDeps", () => {
  it("resolves the template, sends via Resend, and logs the send", async () => {
    writeEmailLog.mockReset().mockResolvedValue({ id: "log-1" });
    const resend = stubResend();
    const client = {} as never;

    const result = await sendEmailWithDeps(
      { resend, client },
      {
        template: "verify_email",
        to: "advisor@example.com",
        data: { verifyUrl: "https://wri.com/verify?token=abc" },
        accountId: "acct-1",
      },
    );

    expect(result).toEqual({ messageId: "msg-1", logId: "log-1" });
    expect(resend.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "advisor@example.com",
        subject: expect.any(String),
        replyTo: undefined,
      }),
    );
    expect(writeEmailLog).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        accountId: "acct-1",
        template: "verify_email",
        recipient: "advisor@example.com",
        resendMessageId: "msg-1",
      }),
    );
  });

  it("forwards a per-send Reply-To override to Resend (§4.5 lead notifications)", async () => {
    writeEmailLog.mockReset().mockResolvedValue({ id: "log-2" });
    const resend = stubResend();

    await sendEmailWithDeps(
      { resend, client: {} as never },
      {
        template: "lead",
        to: "advisor@example.com",
        data: { firmName: "Acme", leadName: "Jane", leadEmail: "jane@example.com" },
        replyTo: "jane@example.com",
      },
    );

    expect(resend.send).toHaveBeenCalledWith(expect.objectContaining({ replyTo: "jane@example.com" }));
  });

  it("defaults accountId to null when the caller doesn't attach one", async () => {
    writeEmailLog.mockReset().mockResolvedValue({ id: "log-3" });
    const resend = stubResend();

    await sendEmailWithDeps(
      { resend, client: {} as never },
      {
        template: "dns_success",
        to: "advisor@example.com",
        data: { firmName: "Acme", siteUrl: "https://acme.com" },
      },
    );

    expect(writeEmailLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ accountId: null }));
  });

  it("never writes an email_log row when the send itself fails (nothing to attach the message id to)", async () => {
    writeEmailLog.mockReset();
    const resend = stubResend({ send: vi.fn().mockRejectedValue(new Error("resend down")) });

    await expect(
      sendEmailWithDeps(
        { resend, client: {} as never },
        {
          template: "payment_failed",
          to: "advisor@example.com",
          data: { firmName: "Acme" },
        },
      ),
    ).rejects.toThrow("resend down");

    expect(writeEmailLog).not.toHaveBeenCalled();
  });
});
