import { describe, expect, it, vi } from "vitest";

import { fetchImageBytes, searchStock, type StockHttp } from "./stock";

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as const;
}

const unsplashBody = {
  results: [
    {
      id: "u1",
      alt_description: "misty forest at dawn",
      urls: { regular: "https://images.unsplash.com/u1" },
      links: { html: "https://unsplash.com/photos/u1" },
      user: { name: "Jane Doe" },
    },
  ],
};

const pexelsBody = {
  photos: [
    {
      id: 2,
      alt: "modern office lobby",
      url: "https://pexels.com/photo/2",
      src: { large: "https://images.pexels.com/2.jpg" },
      photographer: "John Roe",
    },
  ],
};

describe("searchStock — Unsplash + Pexels, key-gated (§6.7)", () => {
  it("returns no candidates when NEITHER provider key is configured", async () => {
    const http = vi.fn();
    const results = await searchStock("calm office", { http });
    expect(results).toEqual([]);
    // Never hit the network without keys.
    expect(http).not.toHaveBeenCalled();
  });

  it("queries Unsplash and maps its commercial-use license fields", async () => {
    const http: StockHttp = vi.fn(async (url: string) => {
      expect(url).toContain("api.unsplash.com");
      return jsonResponse(unsplashBody);
    });
    const results = await searchStock("forest", { http, unsplashKey: "uk" });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      provider: "unsplash",
      photographer: "Jane Doe",
      sourceUrl: "https://unsplash.com/photos/u1",
      downloadUrl: "https://images.unsplash.com/u1",
      altText: "misty forest at dawn",
    });
  });

  it("queries Pexels and maps its fields", async () => {
    const http: StockHttp = vi.fn(async (url: string) => {
      expect(url).toContain("api.pexels.com");
      return jsonResponse(pexelsBody);
    });
    const results = await searchStock("office", { http, pexelsKey: "pk" });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      provider: "pexels",
      photographer: "John Roe",
      downloadUrl: "https://images.pexels.com/2.jpg",
    });
  });

  it("combines results from BOTH providers when both keys exist", async () => {
    const http: StockHttp = vi.fn(async (url: string) =>
      url.includes("unsplash") ? jsonResponse(unsplashBody) : jsonResponse(pexelsBody),
    );
    const results = await searchStock("x", {
      http,
      unsplashKey: "uk",
      pexelsKey: "pk",
    });
    expect(results.map((r) => r.provider).sort()).toEqual(["pexels", "unsplash"]);
  });

  it("treats a provider error as a miss (best-effort — falls through to AI)", async () => {
    const http: StockHttp = vi.fn(async () => {
      throw new Error("network down");
    });
    // Should NOT throw — a stock miss just means AI fallback later.
    const results = await searchStock("x", { http, unsplashKey: "uk" });
    expect(results).toEqual([]);
  });

  it("treats a non-ok HTTP status as a miss for that provider", async () => {
    const http: StockHttp = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({}),
    }));
    const results = await searchStock("x", { http, pexelsKey: "bad" });
    expect(results).toEqual([]);
  });
});

describe("fetchImageBytes — download a chosen stock image to base64", () => {
  it("downloads the bytes and reports the content type", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const http: StockHttp = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: (h: string) => (h === "content-type" ? "image/jpeg" : null) },
      arrayBuffer: async () => bytes.buffer,
    }));
    const out = await fetchImageBytes("https://img/1.jpg", http);
    expect(out?.mimeType).toBe("image/jpeg");
    expect(typeof out?.data).toBe("string"); // base64
    expect(out?.data.length).toBeGreaterThan(0);
  });

  it("returns null on a failed download (best-effort)", async () => {
    const http: StockHttp = vi.fn(async () => {
      throw new Error("boom");
    });
    expect(await fetchImageBytes("https://img/1.jpg", http)).toBeNull();
  });
});
