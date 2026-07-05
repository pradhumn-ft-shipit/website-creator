import { describe, expect, it, vi } from "vitest";

import type { AiImage } from "./ai";
import { SITE_IMAGE_SLOTS } from "./slots";
import type { StockCandidate } from "./stock";
import {
  resolveSiteImages,
  type AssetStore,
  type ResolveSiteImagesDeps,
} from "./resolve";

const SLOT_IDS = SITE_IMAGE_SLOTS.map((s) => s.id);

function stockCandidate(id: string): StockCandidate {
  return {
    provider: "unsplash",
    id,
    photographer: "Jane Doe",
    sourceUrl: `https://unsplash.com/photos/${id}`,
    downloadUrl: `https://images.unsplash.com/${id}`,
    altText: "a calm scene",
  };
}

function aiImage(slotId: string): AiImage {
  return {
    slotId,
    data: "YWk=",
    mimeType: "image/png",
    altText: "Abstract decorative background graphic",
    prompt: "abstract composition",
    usage: { inputTokens: 60, outputTokens: 1290 },
    costUsd: 0.04,
  };
}

function fakeStore(): AssetStore & { calls: unknown[] } {
  const calls: unknown[] = [];
  let n = 0;
  return {
    calls,
    putAsset: vi.fn(async (input) => {
      calls.push(input);
      n += 1;
      return {
        assetId: `asset-${n}`,
        storagePath: `sites/o1/${input.slotId}.img`,
        publicUrl: `https://cdn/${input.slotId}`,
      };
    }),
  };
}

function baseDeps(over: Partial<ResolveSiteImagesDeps> = {}): {
  deps: ResolveSiteImagesDeps;
  persisted: unknown[];
  store: AssetStore & { calls: unknown[] };
  genAi: ReturnType<typeof vi.fn>;
} {
  const persisted: unknown[] = [];
  const store = fakeStore();
  const genAi = vi.fn(async (slot: { id: string }) => aiImage(slot.id));
  const deps: ResolveSiteImagesDeps = {
    orderId: "o1",
    searchStock: vi.fn(async () => [stockCandidate("s1")]),
    fetchImageBytes: vi.fn(async () => ({ data: "c3RvY2s=", mimeType: "image/jpeg" })),
    generateAiImage: genAi,
    store,
    persistManifest: vi.fn(async (m) => {
      persisted.push(m);
    }),
    ...over,
  };
  return { deps, persisted, store, genAi };
}

describe("resolveSiteImages — stock-first, AI-capped, manifest out (§6.7)", () => {
  it("fills every slot from stock and NEVER generates AI when stock covers all", async () => {
    const { deps, persisted, genAi } = baseDeps();
    const manifest = await resolveSiteImages(deps);

    expect(manifest.images).toHaveLength(SITE_IMAGE_SLOTS.length);
    expect(manifest.images.every((i) => i.source === "stock")).toBe(true);
    expect(genAi).not.toHaveBeenCalled(); // the core requirement
    expect(manifest.credits.length).toBe(SITE_IMAGE_SLOTS.length);
    expect(manifest.creditsMarkdown).toContain("Unsplash");
    expect(persisted).toHaveLength(1); // manifest persisted once
  });

  it("uses AI ONLY for slots stock could not fill, capped at the AI budget", async () => {
    // Stock finds nothing → every slot wants AI, but budget = 2.
    const { deps, genAi } = baseDeps({
      searchStock: vi.fn(async () => []),
      aiBudget: 2,
    });
    const manifest = await resolveSiteImages(deps);

    const ai = manifest.images.filter((i) => i.source === "ai");
    const none = manifest.images.filter((i) => i.source === "none");
    expect(ai).toHaveLength(2);
    expect(none).toHaveLength(SITE_IMAGE_SLOTS.length - 2);
    expect(genAi).toHaveBeenCalledTimes(2); // never exceeds budget
    expect(manifest.aiImagesGenerated).toBe(2);
  });

  it("prefers an advisor upload over stock and AI (advisor wins)", async () => {
    const advisorSlots = new Map([[SLOT_IDS[0], "advisor-asset-9"]]);
    const searchStock = vi.fn(async () => [stockCandidate("s1")]);
    const { deps } = baseDeps({ advisorSlots, searchStock });
    const manifest = await resolveSiteImages(deps);

    const first = manifest.images.find((i) => i.slotId === SLOT_IDS[0])!;
    expect(first.source).toBe("advisor");
    expect(first.assetId).toBe("advisor-asset-9");
    // Never searched stock for the advisor-filled slot.
    expect(searchStock).not.toHaveBeenCalledWith(
      expect.stringContaining(SITE_IMAGE_SLOTS[0].stockQuery),
    );
  });

  it("stores AI images as ai_generated assets with alt text (§6.6)", async () => {
    const { deps, store } = baseDeps({ searchStock: vi.fn(async () => []), aiBudget: 3 });
    await resolveSiteImages(deps);
    const kinds = (store.calls as Array<{ kind: string; altText: string }>).map(
      (c) => c.kind,
    );
    expect(kinds.every((k) => k === "ai_generated")).toBe(true);
    for (const c of store.calls as Array<{ altText: string }>) {
      expect(c.altText).toBeTruthy();
    }
  });

  it("stores stock images as stock assets and records credits", async () => {
    const { deps, store } = baseDeps();
    const manifest = await resolveSiteImages(deps);
    const kinds = (store.calls as Array<{ kind: string }>).map((c) => c.kind);
    expect(kinds.every((k) => k === "stock")).toBe(true);
    expect(manifest.credits[0]).toMatchObject({ provider: "unsplash" });
  });

  it("falls to 'none' when a planned stock image fails to download (best-effort)", async () => {
    const { deps } = baseDeps({ fetchImageBytes: vi.fn(async () => null) });
    const manifest = await resolveSiteImages(deps);
    expect(manifest.images.every((i) => i.source === "none")).toBe(true);
    expect(manifest.credits).toHaveLength(0);
  });

  it("sums AI cost into the manifest and defaults the AI budget to the per-site cap (3)", async () => {
    const { deps } = baseDeps({ searchStock: vi.fn(async () => []) });
    const manifest = await resolveSiteImages(deps);
    // 3 slots, all miss stock, default budget 3 → 3 AI images.
    expect(manifest.aiImagesGenerated).toBe(3);
    expect(manifest.costUsd).toBeCloseTo(0.12, 5);
  });
});
