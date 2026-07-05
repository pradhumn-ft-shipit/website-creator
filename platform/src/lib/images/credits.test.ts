import { describe, expect, it } from "vitest";

import {
  STOCK_CREDITS_FILENAME,
  buildStockCreditsMarkdown,
  type StockCreditEntry,
} from "./credits";

describe("STOCK_PHOTO_CREDITS.md (PRD §6.7)", () => {
  it("ships under the exact repo filename the ticket names", () => {
    expect(STOCK_CREDITS_FILENAME).toBe("STOCK_PHOTO_CREDITS.md");
  });

  it("renders one credit line per stock image with provider + photographer + url", () => {
    const entries: StockCreditEntry[] = [
      {
        slotId: "hero_background",
        provider: "unsplash",
        photographer: "Jane Doe",
        sourceUrl: "https://unsplash.com/photos/abc",
      },
      {
        slotId: "cta_background",
        provider: "pexels",
        photographer: "John Roe",
        sourceUrl: "https://pexels.com/photo/123",
      },
    ];
    const md = buildStockCreditsMarkdown(entries);
    expect(md).toContain("Unsplash");
    expect(md).toContain("Pexels");
    expect(md).toContain("Jane Doe");
    expect(md).toContain("John Roe");
    expect(md).toContain("https://unsplash.com/photos/abc");
    expect(md).toContain("hero_background");
  });

  it("states the commercial-use / no-attribution-required license note", () => {
    const md = buildStockCreditsMarkdown([]);
    expect(md.toLowerCase()).toContain("no attribution");
    expect(md.toLowerCase()).toContain("commercial");
  });

  it("handles an empty list gracefully (no stock used → still valid markdown)", () => {
    const md = buildStockCreditsMarkdown([]);
    expect(md).toContain("# ");
    expect(md.toLowerCase()).toContain("no stock");
  });
});
