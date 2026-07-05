import { createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

const { updateEmailLogStatus } = vi.hoisted(() => ({ updateEmailLogStatus: vi.fn() }));
vi.mock("./log", () => ({ updateEmailLogStatus }));

import { applyEmailStatusEvent, verifyWebhookSignature } from "./webhook";

const SECRET = "whsec_" + Buffer.from("test-secret-bytes").toString("base64");

function sign(body: string, id: string, timestamp: string): string {
  const secretBytes = Buffer.from(SECRET.replace(/^whsec_/, ""), "base64");
  const digest = createHmac("sha256", secretBytes)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return `v1,${digest}`;
}

describe("verifyWebhookSignature", () => {
  it("accepts a correctly signed payload", () => {
    const body = JSON.stringify({ type: "email.delivered", data: { email_id: "msg-1" } });
    const id = "msg_abc";
    const timestamp = "1700000000";
    const signature = sign(body, id, timestamp);

    expect(verifyWebhookSignature(SECRET, { id, timestamp, signature }, body)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const body = JSON.stringify({ type: "email.delivered", data: { email_id: "msg-1" } });
    const id = "msg_abc";
    const timestamp = "1700000000";
    const signature = sign(body, id, timestamp);
    const tamperedBody = JSON.stringify({ type: "email.delivered", data: { email_id: "msg-2" } });

    expect(verifyWebhookSignature(SECRET, { id, timestamp, signature }, tamperedBody)).toBe(false);
  });

  it("rejects a wrong secret", () => {
    const body = JSON.stringify({ type: "email.bounced", data: { email_id: "msg-1" } });
    const id = "msg_abc";
    const timestamp = "1700000000";
    const signature = sign(body, id, timestamp);

    expect(
      verifyWebhookSignature("whsec_" + Buffer.from("wrong").toString("base64"), { id, timestamp, signature }, body),
    ).toBe(false);
  });

  it("rejects a malformed signature header without throwing", () => {
    expect(verifyWebhookSignature(SECRET, { id: "x", timestamp: "1", signature: "garbage" }, "{}")).toBe(
      false,
    );
  });

  it("checks multiple space-separated candidate signatures (Svix rotation)", () => {
    const body = JSON.stringify({ type: "email.delivered", data: { email_id: "msg-1" } });
    const id = "msg_abc";
    const timestamp = "1700000000";
    const real = sign(body, id, timestamp);
    const signature = `v1,bm90LXRoZS1yaWdodC1zaWc= ${real}`;

    expect(verifyWebhookSignature(SECRET, { id, timestamp, signature }, body)).toBe(true);
  });
});

describe("applyEmailStatusEvent", () => {
  it("maps email.delivered to a delivered status update", async () => {
    updateEmailLogStatus.mockReset().mockResolvedValue({ updated: true });
    const client = {} as never;

    const result = await applyEmailStatusEvent(client, {
      type: "email.delivered",
      data: { email_id: "msg-1" },
    });

    expect(result).toEqual({ applied: true, status: "delivered" });
    expect(updateEmailLogStatus).toHaveBeenCalledWith(client, "msg-1", "delivered");
  });

  it("maps email.bounced and email.complained without ever calling sendEmail again (no auto-retry)", async () => {
    updateEmailLogStatus.mockReset().mockResolvedValue({ updated: true });

    await applyEmailStatusEvent({} as never, { type: "email.bounced", data: { email_id: "msg-2" } });
    await applyEmailStatusEvent({} as never, { type: "email.complained", data: { email_id: "msg-3" } });

    expect(updateEmailLogStatus).toHaveBeenNthCalledWith(1, expect.anything(), "msg-2", "bounced");
    expect(updateEmailLogStatus).toHaveBeenNthCalledWith(2, expect.anything(), "msg-3", "complained");
    // applyEmailStatusEvent has no send/resend dependency at all — asserted at
    // the module boundary: only `./log` is mocked/imported, nothing email-sending.
  });

  it("ignores event types we don't track (email.sent, email.opened, …) as a no-op", async () => {
    updateEmailLogStatus.mockReset();

    const result = await applyEmailStatusEvent({} as never, {
      type: "email.opened",
      data: { email_id: "msg-4" },
    });

    expect(result).toEqual({ applied: false });
    expect(updateEmailLogStatus).not.toHaveBeenCalled();
  });

  it("no-ops when the event carries no email_id", async () => {
    updateEmailLogStatus.mockReset();

    const result = await applyEmailStatusEvent({} as never, { type: "email.delivered", data: {} });

    expect(result).toEqual({ applied: false });
    expect(updateEmailLogStatus).not.toHaveBeenCalled();
  });
});
