import { describe, expect, it, vi } from "vitest";

import { isRateLimitError } from "@/lib/inngest/errors";

import { IapdClient, type IapdHttpBoundary, type IapdHttpResponse } from "./client";
import { IapdError, IapdRateLimitError } from "./errors";

function res(
  status: number,
  body: unknown,
  bytes: Uint8Array = new Uint8Array(),
): IapdHttpResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    arrayBuffer: async () => bytes.buffer as ArrayBuffer,
  };
}

/** A boundary that yields queued responses in order, recording each request. */
function fakeHttp(responses: IapdHttpResponse[]): {
  http: IapdHttpBoundary;
  calls: string[];
} {
  const calls: string[] = [];
  let i = 0;
  const http: IapdHttpBoundary = async (url) => {
    calls.push(url);
    return responses[i++];
  };
  return { http: vi.fn(http), calls };
}

function searchHit(overrides: Record<string, unknown> = {}) {
  return {
    hits: {
      hits: [
        {
          _source: {
            firm_crd_nb: "123456",
            firm_name: "Acme Advisors LLC",
            brochures: [
              { brochure_id: "b1", brochure_name: "Brochure", brochure_type: "ADV_PART_2A" },
              { brochure_id: "b2", brochure_name: "Supplement", brochure_type: "ADV_PART_2B" },
              { brochure_id: "b3", brochure_name: "Relationship Summary", brochure_type: "FORM_CRS" },
            ],
            ...overrides,
          },
        },
      ],
    },
  };
}

describe("IapdClient.fetchFirmRecord", () => {
  it("maps a firm's brochures into normalised ADV 2A/2B + CRS documents", async () => {
    const { http, calls } = fakeHttp([res(200, searchHit())]);
    const client = new IapdClient(http);

    const record = await client.fetchFirmRecord("123456");

    expect(record.crd).toBe("123456");
    expect(record.firmName).toBe("Acme Advisors LLC");
    expect(record.documents).toHaveLength(3);
    expect(record.documents.map((d) => d.kind).sort()).toEqual(["adv2a", "adv2b", "crs"]);
    expect(calls[0]).toContain("123456");
  });

  it("falls back to the reports URL pattern when a brochure has no pdf_url", async () => {
    const { http } = fakeHttp([res(200, searchHit())]);
    const client = new IapdClient(http);
    const record = await client.fetchFirmRecord("123456");
    const adv2a = record.documents.find((d) => d.kind === "adv2a")!;
    expect(adv2a.url).toContain("/ADV/123456/PDF/b1.pdf");
  });

  it("uses an explicit pdf_url when the API provides one", async () => {
    const { http } = fakeHttp([
      res(
        200,
        searchHit({
          brochures: [
            {
              brochure_id: "b1",
              brochure_type: "FORM_CRS",
              pdf_url: "https://reports.adviserinfo.sec.gov/crs/crs_123456.pdf",
            },
          ],
        }),
      ),
    ]);
    const client = new IapdClient(http);
    const record = await client.fetchFirmRecord("123456");
    expect(record.documents[0].url).toBe(
      "https://reports.adviserinfo.sec.gov/crs/crs_123456.pdf",
    );
  });

  it("maps a 429 to a retryable IapdRateLimitError (009 seam)", async () => {
    const { http } = fakeHttp([res(429, {})]);
    const client = new IapdClient(http);
    const err = await client.fetchFirmRecord("123456").catch((e) => e);
    expect(err).toBeInstanceOf(IapdRateLimitError);
    expect(isRateLimitError(err)).toBe(true);
    expect(err.service).toBe("iapd");
  });

  it("throws IapdError (not rate limit) when no firm record is found", async () => {
    const { http } = fakeHttp([res(200, { hits: { hits: [] } })]);
    const client = new IapdClient(http);
    const err = await client.fetchFirmRecord("999999").catch((e) => e);
    expect(err).toBeInstanceOf(IapdError);
    expect(isRateLimitError(err)).toBe(false);
  });

  it("throws IapdError on a non-ok, non-429 response", async () => {
    const { http } = fakeHttp([res(500, {})]);
    const client = new IapdClient(http);
    await expect(client.fetchFirmRecord("123456")).rejects.toBeInstanceOf(IapdError);
  });
});

describe("IapdClient.downloadDocument", () => {
  it("returns the raw PDF bytes", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const { http } = fakeHttp([res(200, {}, bytes)]);
    const client = new IapdClient(http);
    const result = await client.downloadDocument({
      kind: "crs",
      filename: "crs.pdf",
      url: "https://reports.adviserinfo.sec.gov/crs/crs_123456.pdf",
    });
    expect(Array.from(result)).toEqual([1, 2, 3]);
  });

  it("maps a 429 during download to IapdRateLimitError", async () => {
    const { http } = fakeHttp([res(429, {})]);
    const client = new IapdClient(http);
    await expect(
      client.downloadDocument({ kind: "adv2a", filename: "a.pdf", url: "https://x/a.pdf" }),
    ).rejects.toBeInstanceOf(IapdRateLimitError);
  });

  it("throws IapdError when the download fails", async () => {
    const { http } = fakeHttp([res(404, {})]);
    const client = new IapdClient(http);
    await expect(
      client.downloadDocument({ kind: "adv2a", filename: "a.pdf", url: "https://x/a.pdf" }),
    ).rejects.toBeInstanceOf(IapdError);
  });
});
