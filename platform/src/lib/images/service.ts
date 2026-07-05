/**
 * Env-wired glue for the `images.generate` pipeline step (PRD §6.7, §9.2).
 *
 * `runImagesStep` constructs the real IO boundaries — stock HTTP, Gemini image
 * client (through the 008 cost/quota chokepoint), Supabase Storage + `assets`
 * rows, and the manifest write to `generated_content` — and hands them to the
 * injectable `resolveSiteImages` orchestrator. The pure helpers below
 * (`advisorSlotsFromAssets`, `buildAssetStoragePath`, `extForMime`) are unit-
 * tested; the Supabase/HTTP glue is deferred behind live infra (no Docker/keys),
 * same posture as 012/033.
 */

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import { CostAccumulator, geminiClient, type GeminiClient } from "@/lib/gemini";

import { generateAiImage } from "./ai";
import { resolveSiteImages, type ImageManifest } from "./resolve";
import { SITE_IMAGE_SLOTS, type ImageSlot } from "./slots";
import { fetchImageBytes, searchStock } from "./stock";

type AdminClient = SupabaseClient<Database>;

/**
 * Public Storage bucket generated-site imagery lives in (024 pulls from here).
 *
 * Merge reconciliation (2026-07-06): this is the shared PUBLIC bucket created by
 * 014's migration (`customer-assets`) — it holds both the generated site's
 * imagery (this module) and the public SEC compliance docs (014). It is
 * deliberately NOT 013's `site-assets` bucket, which is PRIVATE and holds
 * advisor-uploaded logo/team/office photos (PII-adjacent). See state/decisions.md.
 */
export const SITE_ASSETS_BUCKET = "customer-assets";

/** The generated_content "page" the image manifest is persisted under. */
export const IMAGE_MANIFEST_PAGE = "_images";

interface AssetLike {
  id: string;
  metadata_json: unknown;
}

/**
 * Build the slotId → assetId map from an account's advisor assets. Only assets
 * that explicitly name a site slot in `metadata_json.slot` count — logos and
 * team/office photos are separate advisor uploads, not resolved image slots.
 */
export function advisorSlotsFromAssets(
  assets: AssetLike[],
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const a of assets) {
    const slot = (a.metadata_json as { slot?: unknown } | null)?.slot;
    if (typeof slot === "string" && slot && !map.has(slot)) {
      map.set(slot, a.id);
    }
  }
  return map;
}

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

export function extForMime(mimeType: string): string {
  return MIME_EXT[mimeType.toLowerCase()] ?? "jpg";
}

export function buildAssetStoragePath(
  orderId: string,
  slotId: string,
  mimeType: string,
  id: string = randomUUID(),
): string {
  return `sites/${orderId}/${slotId}-${id}.${extForMime(mimeType)}`;
}

export interface RunImagesStepDeps {
  client: AdminClient;
  orderId: string;
  accountId: string;
  /** Per-site cost guard; shared across the pipeline's Gemini calls. */
  cost?: CostAccumulator;
  /** Test seams (default to the env-wired real boundaries). */
  gemini?: GeminiClient;
}

/** Read the account's advisor assets so slot-mapped uploads win over stock/AI. */
async function readAdvisorSlots(
  client: AdminClient,
  accountId: string,
): Promise<ReadonlyMap<string, string>> {
  const { data } = await client
    .from("assets")
    .select("id, metadata_json, type")
    .eq("account_id", accountId)
    .in("type", ["office", "team_photo"]);
  return advisorSlotsFromAssets((data as AssetLike[] | null) ?? []);
}

/** Next content version for the image manifest page (append-only, §10.2). */
async function nextManifestVersion(
  client: AdminClient,
  orderId: string,
): Promise<number> {
  const { data } = await client
    .from("generated_content")
    .select("version")
    .eq("order_id", orderId)
    .eq("page", IMAGE_MANIFEST_PAGE)
    .order("version", { ascending: false })
    .limit(1);
  const rows = data as { version: number }[] | null;
  return (rows?.[0]?.version ?? 0) + 1;
}

/**
 * The `images.generate` step body: resolve every slot (stock-first, AI-capped),
 * store outputs, persist the manifest. Returns the manifest for the build step.
 */
export async function runImagesStep(
  deps: RunImagesStepDeps,
): Promise<ImageManifest> {
  const { client, orderId, accountId } = deps;
  const cost = deps.cost ?? new CostAccumulator();
  const gemini = deps.gemini ?? geminiClient({ costAccumulator: cost });

  const advisorSlots = await readAdvisorSlots(client, accountId);

  return resolveSiteImages({
    orderId,
    advisorSlots,
    searchStock: (query) => searchStock(query),
    fetchImageBytes: (url) => fetchImageBytes(url),
    generateAiImage: (slot: ImageSlot) => generateAiImage({ slot, gemini }),
    store: {
      async putAsset(input) {
        const storagePath = buildAssetStoragePath(
          orderId,
          input.slotId,
          input.mimeType,
        );
        const bytes = Uint8Array.from(atob(input.data), (c) => c.charCodeAt(0));
        await client.storage
          .from(SITE_ASSETS_BUCKET)
          .upload(storagePath, bytes, { contentType: input.mimeType, upsert: true });

        const { data: row } = await client
          .from("assets")
          .insert({
            account_id: accountId,
            type: input.kind,
            storage_path: storagePath,
            in_use_locations_json: [{ slot: input.slotId }],
            metadata_json: { ...input.metadata, alt_text: input.altText },
          })
          .select("id")
          .single();

        const { data: pub } = client.storage
          .from(SITE_ASSETS_BUCKET)
          .getPublicUrl(storagePath);

        return {
          assetId: (row as { id: string } | null)?.id ?? "",
          storagePath,
          publicUrl: pub?.publicUrl,
        };
      },
    },
    async persistManifest(manifest) {
      const version = await nextManifestVersion(client, orderId);
      await client.from("generated_content").insert({
        order_id: orderId,
        version,
        page: IMAGE_MANIFEST_PAGE,
        section: "manifest",
        content_json:
          manifest as unknown as Database["public"]["Tables"]["generated_content"]["Insert"]["content_json"],
      });
    },
  });
}

// Re-export the slot set so the build step (024) can enumerate slots.
export { SITE_IMAGE_SLOTS };
