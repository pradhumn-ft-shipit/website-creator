import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/api/envelope";
import { joinWaitlist } from "./service";

function makeClient() {
  const rec: { upsert?: { payload: unknown; options: unknown } } = {};
  const client = {
    from() {
      return {
        upsert: async (payload: unknown, options: unknown) => {
          rec.upsert = { payload, options };
          return { data: null, error: null };
        },
      };
    },
  };
  return { client, rec };
}

describe("joinWaitlist", () => {
  it("upserts a normalized (lowercased, trimmed) email with ignoreDuplicates so re-submits don't duplicate", async () => {
    const { client, rec } = makeClient();
    const result = await joinWaitlist(client as never, {
      email: "  Advisor@Firm.com ",
      industry: "insurance",
    });
    expect(rec.upsert?.payload).toMatchObject({
      email: "advisor@firm.com",
      industry: "insurance",
    });
    expect(rec.upsert?.options).toMatchObject({
      onConflict: "email,industry",
      ignoreDuplicates: true,
    });
    expect(result.status).toBe("joined");
  });

  it("rejects an invalid email before touching the DB", async () => {
    const { client, rec } = makeClient();
    await expect(
      joinWaitlist(client as never, { email: "nope", industry: "law" }),
    ).rejects.toBeInstanceOf(AppError);
    expect(rec.upsert).toBeUndefined();
  });

  it("rejects RIA (it's live, not a waitlist industry)", async () => {
    const { client } = makeClient();
    await expect(
      joinWaitlist(client as never, { email: "a@b.com", industry: "ria" }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
