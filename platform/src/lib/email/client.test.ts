import { describe, expect, it, vi } from "vitest";

import { DEFAULT_FROM, EmailClient, type ResendBoundary } from "./client";
import { EmailRateLimitError, EmailSendError } from "./errors";

function stubSdk(send: ResendBoundary["emails"]["send"]): ResendBoundary {
  return { emails: { send } };
}

describe("EmailClient.send", () => {
  it("sends from the default WRI address and returns the Resend message id", async () => {
    const send = vi.fn().mockResolvedValue({ data: { id: "msg_123" }, error: null });
    const client = new EmailClient(stubSdk(send));

    const result = await client.send({
      to: "advisor@example.com",
      subject: "Hello",
      react: { type: "div", props: {}, key: null } as never,
    });

    expect(result).toEqual({ id: "msg_123" });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ from: DEFAULT_FROM, to: "advisor@example.com" }),
    );
  });

  it("passes a per-send Reply-To override through to Resend (§4.5 lead notifications)", async () => {
    const send = vi.fn().mockResolvedValue({ data: { id: "msg_456" }, error: null });
    const client = new EmailClient(stubSdk(send));

    await client.send({
      to: "advisor@example.com",
      subject: "New lead",
      react: {} as never,
      replyTo: "lead@example.com",
    });

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ replyTo: "lead@example.com" }));
  });

  it("maps a 429 to a retryable EmailRateLimitError", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "too many requests", statusCode: 429 } });
    const client = new EmailClient(stubSdk(send));

    await expect(
      client.send({ to: "a@example.com", subject: "s", react: {} as never }),
    ).rejects.toBeInstanceOf(EmailRateLimitError);
  });

  it("maps a named rate_limit_exceeded error the same way", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "rate limited", name: "rate_limit_exceeded" } });
    const client = new EmailClient(stubSdk(send));

    await expect(
      client.send({ to: "a@example.com", subject: "s", react: {} as never }),
    ).rejects.toBeInstanceOf(EmailRateLimitError);
  });

  it("maps any other Resend error to a non-retryable EmailSendError", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "invalid `to` field", statusCode: 422 } });
    const client = new EmailClient(stubSdk(send));

    await expect(
      client.send({ to: "not-an-email", subject: "s", react: {} as never }),
    ).rejects.toBeInstanceOf(EmailSendError);
  });

  it("wraps a thrown network/SDK error as EmailSendError", async () => {
    const send = vi.fn().mockRejectedValue(new Error("fetch failed"));
    const client = new EmailClient(stubSdk(send));

    await expect(
      client.send({ to: "a@example.com", subject: "s", react: {} as never }),
    ).rejects.toBeInstanceOf(EmailSendError);
  });
});
