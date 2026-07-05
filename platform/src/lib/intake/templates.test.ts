import { describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/api/envelope";
import {
  finalizeAndBuild,
  isTemplateId,
  selectTemplate,
  TEMPLATE_CATALOG,
  TEMPLATE_IDS,
} from "./templates";

function makeClient(opts: { site?: { id: string; template_id?: string | null } | null } = {}) {
  const writes: { update?: Record<string, unknown>; insert?: Record<string, unknown> } = {};
  const client = {
    from(table: string) {
      if (table === "accounts") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "acc-1" }, error: null }) }) }) };
      }
      if (table === "orders") {
        return { select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [{ id: "ord-1" }], error: null }) }) }) }) };
      }
      if (table === "sites") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opts.site ?? null, error: null }) }) }),
          update: (payload: Record<string, unknown>) => {
            writes.update = payload;
            return { eq: async () => ({ error: null }) };
          },
          insert: async (payload: Record<string, unknown>) => {
            writes.insert = payload;
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  return { client: client as never, writes };
}

describe("TEMPLATE_CATALOG (§6.1)", () => {
  it("ships exactly the three templates with persona + aesthetic", () => {
    expect(TEMPLATE_CATALOG.map((t) => t.id)).toEqual(TEMPLATE_IDS);
    for (const t of TEMPLATE_CATALOG) {
      expect(t.persona.length).toBeGreaterThan(0);
      expect(t.aesthetic.length).toBeGreaterThan(0);
      expect(t.previewAccentDefault).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
  it("guards the template id against the closed set", () => {
    expect(isTemplateId("trust")).toBe(true);
    expect(isTemplateId("fancy")).toBe(false);
  });
});

describe("selectTemplate (one site per account)", () => {
  it("inserts the first site with the chosen template", async () => {
    const { client, writes } = makeClient({ site: null });
    const res = await selectTemplate({ client, userId: "u1" }, "modern");
    expect(res).toEqual({ templateId: "modern", created: true });
    expect(writes.insert).toMatchObject({ account_id: "acc-1", template_id: "modern" });
  });

  it("updates the existing site rather than creating a second (re-pick)", async () => {
    const { client, writes } = makeClient({ site: { id: "site-1", template_id: "trust" } });
    const res = await selectTemplate({ client, userId: "u1" }, "boutique");
    expect(res).toEqual({ templateId: "boutique", created: false });
    expect(writes.update).toEqual({ template_id: "boutique" });
    expect(writes.insert).toBeUndefined();
  });

  it("rejects an invalid template id", async () => {
    const { client } = makeClient();
    await expect(selectTemplate({ client, userId: "u1" }, "nope" as never)).rejects.toBeInstanceOf(AppError);
  });
});

describe("finalizeAndBuild (§4.1.14 — build enqueue moved off payment)", () => {
  it("emits order.created once a template is chosen", async () => {
    const { client } = makeClient({ site: { id: "site-1", template_id: "trust" } });
    const send = vi.fn(async () => ({}));
    const res = await finalizeAndBuild({ client, userId: "u1", send });
    expect(res).toEqual({ orderId: "ord-1" });
    expect(send).toHaveBeenCalledWith({ name: "order.created", data: { orderId: "ord-1", accountId: "acc-1" } });
  });

  it("refuses to build before a template is selected", async () => {
    const { client } = makeClient({ site: { id: "site-1", template_id: null } });
    const send = vi.fn(async () => ({}));
    await expect(finalizeAndBuild({ client, userId: "u1", send })).rejects.toBeInstanceOf(AppError);
    expect(send).not.toHaveBeenCalled();
  });
});
