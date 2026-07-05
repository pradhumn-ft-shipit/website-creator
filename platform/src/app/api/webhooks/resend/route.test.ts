import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { applyEmailStatusEvent, verifyWebhookSignature } = vi.hoisted(() => ({
  applyEmailStatusEvent: vi.fn(),
  verifyWebhookSignature: vi.fn(),
}));
vi.mock("@/lib/email", async () => {
  const actual = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
  return { ...actual, applyEmailStatusEvent, verifyWebhookSignature };
});
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

import { POST } from "./route";

function req(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/webhooks/resend", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/webhooks/resend", () => {
  beforeEach(() => {
    applyEmailStatusEvent.mockReset();
    verifyWebhookSignature.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("skips signature verification when RESEND_WEBHOOK_SECRET is unset (dev)", async () => {
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "");
    applyEmailStatusEvent.mockResolvedValue({ applied: true, status: "delivered" });

    const res = await POST(req({ type: "email.delivered", data: { email_id: "msg-1" } }), undefined);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({ received: true, applied: true, status: "delivered" });
    expect(verifyWebhookSignature).not.toHaveBeenCalled();
  });

  it("rejects a request with no signature headers when a secret IS configured", async () => {
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "whsec_abc");

    const res = await POST(req({ type: "email.delivered", data: { email_id: "msg-1" } }), undefined);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_signature");
    expect(applyEmailStatusEvent).not.toHaveBeenCalled();
  });

  it("rejects an invalid signature", async () => {
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "whsec_abc");
    verifyWebhookSignature.mockReturnValue(false);

    const res = await POST(
      req(
        { type: "email.bounced", data: { email_id: "msg-1" } },
        { "svix-id": "id1", "svix-timestamp": "1700000000", "svix-signature": "v1,bad" },
      ),
      undefined,
    );

    expect(res.status).toBe(401);
    expect(applyEmailStatusEvent).not.toHaveBeenCalled();
  });

  it("applies the event when the signature is valid", async () => {
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "whsec_abc");
    verifyWebhookSignature.mockReturnValue(true);
    applyEmailStatusEvent.mockResolvedValue({ applied: true, status: "bounced" });

    const res = await POST(
      req(
        { type: "email.bounced", data: { email_id: "msg-1" } },
        { "svix-id": "id1", "svix-timestamp": "1700000000", "svix-signature": "v1,good" },
      ),
      undefined,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({ received: true, applied: true, status: "bounced" });
  });

  it("returns 400 on a malformed JSON payload", async () => {
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "");
    const res = await POST(
      new Request("http://localhost/api/webhooks/resend", { method: "POST", body: "not json" }),
      undefined,
    );
    expect(res.status).toBe(400);
    expect(applyEmailStatusEvent).not.toHaveBeenCalled();
  });
});
