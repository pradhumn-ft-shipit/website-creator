/**
 * resolveSiteImages — the pure-ish orchestrator behind the `images.generate`
 * pipeline step (PRD §6.7, §9.2). Given a site's image slots, it:
 *
 *   1. honours advisor uploads mapped to a slot (real photos always win),
 *   2. searches stock (Unsplash + Pexels) FIRST for every other slot,
 *   3. generates AI (abstract/office/nature, capped) ONLY for stock misses,
 *   4. stores each resolved image as an `assets` row (`stock` / `ai_generated`)
 *      with WCAG alt text (§6.6),
 *   5. emits `STOCK_PHOTO_CREDITS.md` content + an image manifest that the build
 *      step (024) consumes to place images and commit the credits file.
 *
 * All IO is injected (`searchStock`, `fetchImageBytes`, `generateAiImage`,
 * `store`, `persistManifest`) so the resolution ORDER and the AI CAP — the two
 * behaviours that matter — are unit-tested without a live Supabase / Gemini /
 * network. The env-wired glue lives in `service.ts`.
 */

import { MAX_IMAGES_PER_SITE } from "@/lib/gemini";

import type { AiImage } from "./ai";
import {
  buildStockCreditsMarkdown,
  type StockCreditEntry,
} from "./credits";
import {
  SITE_IMAGE_SLOTS,
  planImageResolution,
  type ImageSlot,
  type SlotSource,
} from "./slots";
import type { StockCandidate } from "./stock";

export interface ResolvedImage {
  slotId: string;
  source: SlotSource;
  /** Present for advisor / stock / ai — the `assets` row backing this slot. */
  assetId?: string;
  storagePath?: string;
  publicUrl?: string;
  /** WCAG alt text (§6.6); absent only for `none`. */
  altText?: string;
}

export interface ImageManifest {
  orderId: string;
  images: ResolvedImage[];
  /** Stock attributions for STOCK_PHOTO_CREDITS.md. */
  credits: StockCreditEntry[];
  creditsMarkdown: string;
  aiImagesGenerated: number;
  /** Summed AI generation cost (USD) for telemetry / the cost guard. */
  costUsd: number;
}

/** Stores an image's bytes + its `assets` row, returning the row's ids. */
export interface AssetStore {
  putAsset(input: {
    kind: "stock" | "ai_generated";
    slotId: string;
    data: string; // base64 bytes
    mimeType: string;
    altText: string;
    metadata: Record<string, unknown>;
  }): Promise<{ assetId: string; storagePath: string; publicUrl?: string }>;
}

export interface ResolveSiteImagesDeps {
  orderId: string;
  /** slotId → advisor asset id, for slots an advisor upload already covers. */
  advisorSlots?: ReadonlyMap<string, string>;
  /** AI image budget for this run; defaults to the per-site cap (3, §6.7/§8.4). */
  aiBudget?: number;
  searchStock: (query: string) => Promise<StockCandidate[]>;
  fetchImageBytes: (
    url: string,
  ) => Promise<{ data: string; mimeType: string } | null>;
  generateAiImage: (slot: ImageSlot) => Promise<AiImage>;
  store: AssetStore;
  persistManifest: (manifest: ImageManifest) => Promise<void>;
}

export async function resolveSiteImages(
  deps: ResolveSiteImagesDeps,
): Promise<ImageManifest> {
  const advisorSlots = deps.advisorSlots ?? new Map<string, string>();
  const aiBudget = deps.aiBudget ?? MAX_IMAGES_PER_SITE;

  // Phase 1 — search stock for every slot an advisor upload does NOT already
  // cover. The chosen candidate (if any) determines `stockFilled` for planning.
  const chosenStock = new Map<string, StockCandidate>();
  for (const slot of SITE_IMAGE_SLOTS) {
    if (advisorSlots.has(slot.id)) continue;
    const candidates = await deps.searchStock(slot.stockQuery);
    if (candidates.length > 0) chosenStock.set(slot.id, candidates[0]);
  }

  // Phase 2 — plan the source for each slot (stock-first, AI-capped).
  const plans = planImageResolution({
    advisorFilled: new Set(advisorSlots.keys()),
    stockFilled: new Set(chosenStock.keys()),
    aiBudget,
  });

  // Phase 3 — materialise each planned slot.
  const images: ResolvedImage[] = [];
  const credits: StockCreditEntry[] = [];
  let aiImagesGenerated = 0;
  let costUsd = 0;

  for (const plan of plans) {
    const slot = SITE_IMAGE_SLOTS.find((s) => s.id === plan.slotId)!;

    if (plan.source === "advisor") {
      images.push({
        slotId: slot.id,
        source: "advisor",
        assetId: advisorSlots.get(slot.id),
      });
      continue;
    }

    if (plan.source === "stock") {
      const candidate = chosenStock.get(slot.id)!;
      const bytes = await deps.fetchImageBytes(candidate.downloadUrl);
      if (!bytes) {
        // Download failed — degrade to typography rather than block the build.
        images.push({ slotId: slot.id, source: "none" });
        continue;
      }
      const stored = await deps.store.putAsset({
        kind: "stock",
        slotId: slot.id,
        data: bytes.data,
        mimeType: bytes.mimeType,
        altText: candidate.altText,
        metadata: {
          provider: candidate.provider,
          photographer: candidate.photographer,
          source_url: candidate.sourceUrl,
        },
      });
      credits.push({
        slotId: slot.id,
        provider: candidate.provider,
        photographer: candidate.photographer,
        sourceUrl: candidate.sourceUrl,
      });
      images.push({
        slotId: slot.id,
        source: "stock",
        assetId: stored.assetId,
        storagePath: stored.storagePath,
        publicUrl: stored.publicUrl,
        altText: candidate.altText,
      });
      continue;
    }

    if (plan.source === "ai") {
      const ai = await deps.generateAiImage(slot);
      aiImagesGenerated += 1;
      costUsd += ai.costUsd;
      const stored = await deps.store.putAsset({
        kind: "ai_generated",
        slotId: slot.id,
        data: ai.data,
        mimeType: ai.mimeType,
        altText: ai.altText,
        metadata: { prompt: ai.prompt, subject: slot.aiSubject },
      });
      images.push({
        slotId: slot.id,
        source: "ai",
        assetId: stored.assetId,
        storagePath: stored.storagePath,
        publicUrl: stored.publicUrl,
        altText: ai.altText,
      });
      continue;
    }

    // none — leave the slot empty; the template falls back to typography.
    images.push({ slotId: slot.id, source: "none" });
  }

  const manifest: ImageManifest = {
    orderId: deps.orderId,
    images,
    credits,
    creditsMarkdown: buildStockCreditsMarkdown(credits),
    aiImagesGenerated,
    costUsd,
  };

  await deps.persistManifest(manifest);
  return manifest;
}
