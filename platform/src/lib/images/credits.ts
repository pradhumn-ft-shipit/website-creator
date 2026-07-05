/**
 * STOCK_PHOTO_CREDITS.md generator (PRD §6.7).
 *
 * Unsplash and Pexels license their photos for commercial use with NO attribution
 * required — but we still ship a credits file in every generated site's repo as a
 * courtesy + a paper trail of exactly which third-party image sits in which slot.
 * Pure string builder; the resolve step writes the output into the site repo (024).
 */

/** The filename this document ships under, at the generated site's repo root. */
export const STOCK_CREDITS_FILENAME = "STOCK_PHOTO_CREDITS.md";

export type StockProvider = "unsplash" | "pexels";

export interface StockCreditEntry {
  /** The site image slot this stock photo fills. */
  slotId: string;
  provider: StockProvider;
  photographer: string;
  sourceUrl: string;
}

const PROVIDER_LABEL: Record<StockProvider, string> = {
  unsplash: "Unsplash",
  pexels: "Pexels",
};

/** Render the credits markdown for a site's stock photos. */
export function buildStockCreditsMarkdown(entries: StockCreditEntry[]): string {
  const lines: string[] = [
    "# Stock Photo Credits",
    "",
    "The stock images on this site are licensed for **commercial use** and require " +
      "**no attribution** (Unsplash License / Pexels License). The credits below are " +
      "provided as a courtesy and record of provenance.",
    "",
  ];

  if (entries.length === 0) {
    lines.push("_No stock photos are used on this site._");
    lines.push("");
    return lines.join("\n");
  }

  lines.push("| Slot | Provider | Photographer | Source |");
  lines.push("| --- | --- | --- | --- |");
  for (const e of entries) {
    lines.push(
      `| \`${e.slotId}\` | ${PROVIDER_LABEL[e.provider]} | ${e.photographer} | ${e.sourceUrl} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}
