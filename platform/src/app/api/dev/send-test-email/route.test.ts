import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendEmail } = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/email", async () => {
  const actual = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
  return { ...actual, sendEmail };
});

import { POST } from "./route";

function req(body?: unknown) {
  return new Request("http://localhost/api/dev/send-test-email", {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("POST /api/dev/send-test-email", () => {
  beforeEach(() => {
    sendEmail.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 404 in production (never send from prod)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await POST(req({}), undefined);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("not_found");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends the default template to the Resend sandbox address when no body is given", async () => {
    vi.stubEnv("NODE_ENV", "development");
    sendEmail.mockResolvedValue({ messageId: "msg-1", logId: "log-1" });

    const res = await POST(req(), undefined);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error).toBeNull();
    expect(body.data).toMatchObject({ template: "verify_email", messageId: "msg-1", logId: "log-1" });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ template: "verify_email" }),
    );
  });

  it("honors an explicit template + to + replyTo through the envelope", async () => {
    vi.stubEnv("NODE_ENV", "development");
    sendEmail.mockResolvedValue({ messageId: "msg-2", logId: "log-2" });

    const res = await POST(
      req({ template: "lead", to: "advisor@example.com", replyTo: "lead@example.com" }),
      undefined,
    );
    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "lead",
        to: "advisor@example.com",
        replyTo: "lead@example.com",
      }),
    );
  });

  it("rejects an unknown template with a 400", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const res = await POST(req({ template: "not_a_template" }), undefined);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("unknown_template");
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
