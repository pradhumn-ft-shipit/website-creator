import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/api/envelope";
import { updateEmailLogStatus, writeEmailLog } from "./log";

type Recorder = { insertedRows?: unknown; updatedRows?: unknown; updateFilters?: Record<string, unknown> };

/** Mock service-role client covering insert().select().single() + update().eq().select(). */
function makeClient(opts: {
  insertResult?: { id: string } | null;
  insertError?: { message: string } | null;
  updateMatches?: Array<{ id: string }>;
  updateError?: { message: string } | null;
}) {
  const rec: Recorder = {};

  const client = {
    from() {
      return {
        insert: (rows: unknown) => {
          rec.insertedRows = rows;
          return {
            select: () => ({
              single: async () => ({
                data: opts.insertError ? null : opts.insertResult,
                error: opts.insertError ?? null,
              }),
            }),
          };
        },
        update: (rows: unknown) => {
          rec.updatedRows = rows;
          const filters: Record<string, unknown> = {};
          const chain = {
            eq: (col: string, val: unknown) => {
              filters[col] = val;
              return {
                select: async () => ({
                  data: opts.updateError ? null : (opts.updateMatches ?? []),
                  error: opts.updateError ?? null,
                }),
              };
            },
          };
          rec.updateFilters = filters;
          return chain;
        },
      };
    },
  };

  return { client, rec };
}

describe("writeEmailLog", () => {
  it("inserts a `sent` row with the Resend message id", async () => {
    const { client, rec } = makeClient({ insertResult: { id: "log-1" } });

    const result = await writeEmailLog(client as never, {
      accountId: "acct-1",
      template: "lead",
      recipient: "advisor@example.com",
      resendMessageId: "msg-123",
    });

    expect(result).toEqual({ id: "log-1" });
    expect(rec.insertedRows).toMatchObject({
      account_id: "acct-1",
      template: "lead",
      recipient: "advisor@example.com",
      resend_message_id: "msg-123",
      status: "sent",
    });
  });

  it("defaults accountId to null when omitted", async () => {
    const { client, rec } = makeClient({ insertResult: { id: "log-2" } });

    await writeEmailLog(client as never, {
      template: "verify_email",
      recipient: "a@example.com",
      resendMessageId: "msg-2",
    });

    expect(rec.insertedRows).toMatchObject({ account_id: null });
  });

  it("throws an AppError when the insert fails", async () => {
    const { client } = makeClient({ insertError: { message: "db down" } });

    await expect(
      writeEmailLog(client as never, {
        template: "lead",
        recipient: "a@example.com",
        resendMessageId: "msg-3",
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe("updateEmailLogStatus", () => {
  it("marks a matching row delivered and stamps delivered_at", async () => {
    const { client, rec } = makeClient({ updateMatches: [{ id: "log-1" }] });

    const result = await updateEmailLogStatus(client as never, "msg-123", "delivered");

    expect(result).toEqual({ updated: true });
    expect(rec.updatedRows).toMatchObject({ status: "delivered" });
    expect(rec.updatedRows as { delivered_at?: string }).toHaveProperty("delivered_at");
  });

  it("marks bounced/complained WITHOUT stamping delivered_at (no auto-retry — just the status write)", async () => {
    const { client, rec } = makeClient({ updateMatches: [{ id: "log-1" }] });

    await updateEmailLogStatus(client as never, "msg-123", "bounced");

    expect(rec.updatedRows).toEqual({ status: "bounced" });
  });

  it("reports updated:false when no row matched the message id", async () => {
    const { client } = makeClient({ updateMatches: [] });

    const result = await updateEmailLogStatus(client as never, "unknown-msg", "delivered");

    expect(result).toEqual({ updated: false });
  });

  it("throws an AppError when the update fails", async () => {
    const { client } = makeClient({ updateError: { message: "db down" } });

    await expect(updateEmailLogStatus(client as never, "msg-123", "delivered")).rejects.toBeInstanceOf(
      AppError,
    );
  });
});
