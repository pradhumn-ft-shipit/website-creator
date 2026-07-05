import { describe, expect, it, vi } from "vitest";

import { IapdError, IapdRateLimitError } from "./errors";
import { ASSETS_BUCKET, fetchIapdDocuments } from "./service";

/** Supabase double covering accounts / intake_data / assets + Storage. */
function makeClient(opts: {
  crdNumber?: string | null;
  scrapeResultJson?: unknown;
  existingAssets?: Record<string, { id: string }>;
  uploadError?: boolean;
  insertError?: boolean;
} = {}) {
  const uploads: Array<{ bucket: string; path: string }> = [];
  const inserted: Array<Record<string, unknown>> = [];
  let nextId = 1;

  const client = {
    storage: {
      from(bucket: string) {
        return {
          upload: async (path: string) => {
            uploads.push({ bucket, path });
            return opts.uploadError
              ? { data: null, error: { message: "boom" } }
              : { data: { path }, error: null };
          },
        };
      },
    },
    from(table: string) {
      if (table === "accounts") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data:
                  opts.crdNumber === undefined
                    ? { crd_number: null }
                    : { crd_number: opts.crdNumber },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "intake_data") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { scrape_result_json: opts.scrapeResultJson ?? null },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "assets") {
        return {
          // .select("id").eq("account_id", accountId).eq("type", type)...
          select: () => ({
            eq: () => ({
              eq: (_col: string, type: string) => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({
                      data: opts.existingAssets?.[type] ?? null,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
          insert: (payload: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                inserted.push(payload);
                if (opts.insertError) return { data: null, error: { message: "boom" } };
                return { data: { id: `asset-${nextId++}` }, error: null };
              },
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };

  return { client, uploads, inserted };
}

const bytes = new Uint8Array([1, 2, 3]);

const threeDocIapd = {
  fetchFirmRecord: vi.fn(async (crd: string) => ({
    crd,
    firmName: "Acme Advisors",
    documents: [
      { kind: "adv2a" as const, filename: "adv2a.pdf", url: "https://x/adv2a.pdf" },
      { kind: "adv2b" as const, filename: "adv2b.pdf", url: "https://x/adv2b.pdf" },
      { kind: "crs" as const, filename: "crs.pdf", url: "https://x/crs.pdf" },
    ],
  })),
  downloadDocument: vi.fn(async () => bytes),
};

describe("fetchIapdDocuments", () => {
  it("skips when the account has no CRD number", async () => {
    const { client } = makeClient({ crdNumber: null });
    const outcome = await fetchIapdDocuments({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: client as any,
      accountId: "acct-1",
    });
    expect(outcome).toEqual({ route: "skipped", reason: "no_crd" });
  });

  it("a known test CRD pulls and stores ADV 2A/2B + CRS as typed doc_adv/doc_crs assets", async () => {
    const { client, uploads, inserted } = makeClient({ crdNumber: "123456" });
    const outcome = await fetchIapdDocuments({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: client as any,
      accountId: "acct-1",
      iapd: threeDocIapd,
    });

    expect(outcome.route).toBe("stored");
    if (outcome.route !== "stored") throw new Error("expected stored");
    expect(outcome.source).toBe("iapd");
    expect(outcome.assetIds).toHaveLength(3);

    expect(uploads.every((u) => u.bucket === ASSETS_BUCKET)).toBe(true);
    expect(inserted.map((i) => i.type).sort()).toEqual(["doc_adv", "doc_adv", "doc_crs"]);
    expect(inserted.every((i) => i.account_id === "acct-1")).toBe(true);
    expect(threeDocIapd.downloadDocument).toHaveBeenCalledTimes(3);
  });

  it("chains a re-fetch onto the prior asset via replaced_from_id", async () => {
    const { client, inserted } = makeClient({
      crdNumber: "123456",
      existingAssets: { doc_crs: { id: "old-crs-asset" } },
    });
    const iapd = {
      fetchFirmRecord: vi.fn(async () => ({
        crd: "123456",
        documents: [{ kind: "crs" as const, filename: "crs.pdf", url: "https://x/crs.pdf" }],
      })),
      downloadDocument: vi.fn(async () => bytes),
    };

    await fetchIapdDocuments({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: client as any,
      accountId: "acct-1",
      iapd,
    });

    expect(inserted[0].replaced_from_id).toBe("old-crs-asset");
  });

  it("falls back to the already-crawled site when IAPD hard-fails, and logs unavailability", async () => {
    const scrapeResult = {
      url: "https://acme.com",
      total: 1,
      pages: [
        {
          url: "https://acme.com/disclosures",
          markdown: "",
          html: `<a href="/crs.pdf">Form CRS</a>`,
        },
      ],
    };
    const { client, inserted } = makeClient({ crdNumber: "123456", scrapeResultJson: scrapeResult });
    const iapd = {
      fetchFirmRecord: vi.fn(async () => {
        throw new IapdError("not found", "https://api.adviserinfo.sec.gov/search/firm");
      }),
      downloadDocument: vi.fn(async () => bytes),
    };
    const logUnavailability = vi.fn(async () => undefined);

    const outcome = await fetchIapdDocuments({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: client as any,
      accountId: "acct-1",
      orderId: "order-1",
      iapd,
      logUnavailability,
    });

    expect(outcome.route).toBe("stored");
    if (outcome.route !== "stored") throw new Error("expected stored");
    expect(outcome.source).toBe("scrape");
    expect(inserted).toHaveLength(1);
    expect(inserted[0].type).toBe("doc_crs");
    expect(logUnavailability).toHaveBeenCalledWith(
      expect.objectContaining({ service: "iapd", code: "iapd_unavailable" }),
    );
  });

  it("routes to upload_prompt when both IAPD and the scrape fallback come up empty", async () => {
    const { client } = makeClient({ crdNumber: "123456", scrapeResultJson: null });
    const iapd = {
      fetchFirmRecord: vi.fn(async () => {
        throw new IapdError("not found", "https://x");
      }),
      downloadDocument: vi.fn(async () => bytes),
    };

    const outcome = await fetchIapdDocuments({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: client as any,
      accountId: "acct-1",
      orderId: "order-1",
      iapd,
      logUnavailability: async () => undefined,
    });

    expect(outcome).toEqual({ route: "upload_prompt", reason: "iapd_and_scrape_unavailable" });
  });

  it("routes to upload_prompt (no_documents_found) when IAPD succeeds but reports no brochures", async () => {
    const { client } = makeClient({ crdNumber: "123456", scrapeResultJson: null });
    const iapd = {
      fetchFirmRecord: vi.fn(async () => ({ crd: "123456", documents: [] })),
      downloadDocument: vi.fn(async () => bytes),
    };

    const outcome = await fetchIapdDocuments({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: client as any,
      accountId: "acct-1",
      iapd,
    });

    expect(outcome).toEqual({ route: "upload_prompt", reason: "no_documents_found" });
  });

  it("propagates a rate-limit error for Inngest backoff instead of falling back", async () => {
    const { client } = makeClient({ crdNumber: "123456" });
    const iapd = {
      fetchFirmRecord: vi.fn(async () => {
        throw new IapdRateLimitError("https://x");
      }),
      downloadDocument: vi.fn(async () => bytes),
    };

    await expect(
      fetchIapdDocuments({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client: client as any,
        accountId: "acct-1",
        iapd,
      }),
    ).rejects.toBeInstanceOf(IapdRateLimitError);
  });

  it("surfaces a storage upload failure as an AppError", async () => {
    const { client } = makeClient({ crdNumber: "123456", uploadError: true });
    await expect(
      fetchIapdDocuments({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client: client as any,
        accountId: "acct-1",
        iapd: threeDocIapd,
      }),
    ).rejects.toMatchObject({ code: "iapd_asset_upload_failed" });
  });

  it("surfaces an asset-record failure as an AppError", async () => {
    const { client } = makeClient({ crdNumber: "123456", insertError: true });
    await expect(
      fetchIapdDocuments({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client: client as any,
        accountId: "acct-1",
        iapd: threeDocIapd,
      }),
    ).rejects.toMatchObject({ code: "iapd_asset_record_failed" });
  });

  it("prefers an explicit crdNumber override over the persisted account value", async () => {
    const { client } = makeClient({ crdNumber: null });
    const outcome = await fetchIapdDocuments({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: client as any,
      accountId: "acct-1",
      crdNumber: "999999",
      iapd: threeDocIapd,
    });
    expect(outcome.route).toBe("stored");
  });
});
