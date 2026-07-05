/**
 * Asset capture (PRD §4.1.11 · §6.8). Logo, team photos, office photos → the
 * private `site-assets` bucket + typed `assets` rows; team photos additionally
 * seed `team_members` rows the advisor edits later (030).
 *
 * Logo processing is deliberately split into a PURE core (background detection,
 * dominant-color extraction, sized-variant PLAN, wordmark fallback — all
 * unit-tested without a filesystem) and thin IO. Per ticket 013 decision
 * (option 2): this ticket computes the variant *plan* (the target dimensions +
 * roles) and the dominant colour; the actual pixel resizing (favicon/header/
 * social) is done at build time in 024, so no image-processing dependency
 * (sharp) is pulled in here. "No auto-background removal in v1" (§6.8) holds —
 * we only *detect* the background type to answer the light/dark question.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { AppError } from "@/lib/api/envelope";
import type { Database } from "@/types/database.types";

import { resolveAccountAndOrder } from "./confirm";

type DbClient = SupabaseClient<Database>;

export const ASSETS_BUCKET = "site-assets";
export const MAX_ASSET_BYTES = 15 * 1024 * 1024;
export const ACCEPTED_IMAGE_EXT = ["png", "svg", "jpg", "jpeg", "webp"] as const;
/** Logo accepts only the §6.8 formats. */
export const ACCEPTED_LOGO_EXT = ["png", "svg", "jpg", "jpeg"] as const;

export type AssetKind = "logo" | "team_photo" | "office";
/** Maps the intake asset kind to the `assets.type` check-constraint value. */
const DB_TYPE: Record<AssetKind, string> = {
  logo: "logo",
  team_photo: "team_photo",
  office: "office",
};

export interface AssetFileInput {
  filename: string;
  bytes: Uint8Array;
  kind: AssetKind;
  /** Optional metadata used to seed a team_member (team photos only). */
  teamMember?: { name?: string; title?: string };
}

// ---- pure core: logo processing (§6.8) ------------------------------------

function ext(filename: string): string {
  return (filename.split(".").pop() ?? "").toLowerCase();
}

/** The three sized variants a template consumes; resized at build (024). */
export const LOGO_VARIANT_PLAN = [
  { role: "favicon", width: 32, height: 32 },
  { role: "header", width: 200, height: 60 },
  { role: "social", width: 1200, height: 630 },
] as const;

export interface LogoProcessing {
  format: string;
  /** Whether the logo art sits on transparency or a solid fill. */
  background: "transparent" | "solid" | "unknown";
  /** Suggested accent, e.g. "#1F6F52", or null when it can't be sampled. */
  dominantColor: string | null;
  variantPlan: typeof LOGO_VARIANT_PLAN;
}

/**
 * Detect a raster logo's background from its header bytes (no decode library):
 * a PNG with a transparency (alpha / tRNS) signal reads as transparent, SVG is
 * treated as transparent, everything else (JPG) is solid. Best-effort — the
 * advisor still confirms light/dark in the UI (§6.8), this only sets the default.
 */
export function detectLogoBackground(filename: string, bytes: Uint8Array): LogoProcessing["background"] {
  const e = ext(filename);
  if (e === "svg") return "transparent";
  if (e === "jpg" || e === "jpeg") return "solid";
  if (e === "png") {
    // PNG colour type lives at byte 25 (IHDR); 6 = RGBA, 4 = grey+alpha → has alpha.
    const colorType = bytes[25];
    if (colorType === 6 || colorType === 4) return "transparent";
    // A tRNS chunk also signals transparency on palette/RGB PNGs.
    if (hasTrnsChunk(bytes)) return "transparent";
    return "solid";
  }
  return "unknown";
}

function hasTrnsChunk(bytes: Uint8Array): boolean {
  // Scan the first ~2KB for the ASCII "tRNS" chunk marker.
  const limit = Math.min(bytes.length - 4, 2048);
  for (let i = 8; i < limit; i++) {
    if (bytes[i] === 0x74 && bytes[i + 1] === 0x52 && bytes[i + 2] === 0x4e && bytes[i + 3] === 0x53) {
      return true;
    }
  }
  return false;
}

/**
 * Pick a dominant/accent colour. If the extraction (012) already sampled brand
 * colours off the site, prefer the first of those (the highest-signal source);
 * otherwise return null and let the caller fall back to the template default.
 * v1 does not decode raster pixels here — 024 refines this at build if needed.
 */
export function dominantColorHex(extractedBrandColors: string[] | null | undefined): string | null {
  const first = (extractedBrandColors ?? []).find((c) => /^#?[0-9a-fA-F]{6}$/.test(c));
  if (!first) return null;
  return first.startsWith("#") ? first.toUpperCase() : `#${first.toUpperCase()}`;
}

export function processLogo(
  filename: string,
  bytes: Uint8Array,
  extractedBrandColors?: string[] | null,
): LogoProcessing {
  return {
    format: ext(filename),
    background: detectLogoBackground(filename, bytes),
    dominantColor: dominantColorHex(extractedBrandColors),
    variantPlan: LOGO_VARIANT_PLAN,
  };
}

/**
 * Wordmark fallback (§6.8): when no logo is uploaded, derive a clean wordmark
 * from the firm name (rendered in the template heading font downstream). Returns
 * null for an empty/whitespace name so the caller can skip rather than show a
 * blank mark. Never AI-generates a logo (§6.7).
 */
export function wordmarkFrom(firmName: string | null | undefined): { text: string } | null {
  const text = (firmName ?? "").trim();
  return text ? { text } : null;
}

// ---- IO -------------------------------------------------------------------

export interface AssetDeps {
  /** Cookie-bound RLS client — proves ownership + inserts rows (owner-checked). */
  rls: DbClient;
  /** Service-role client — writes to the private bucket (no per-object policy). */
  admin: DbClient;
  userId: string;
}

function validate(file: AssetFileInput): void {
  const e = ext(file.filename);
  const accepted: readonly string[] = file.kind === "logo" ? ACCEPTED_LOGO_EXT : ACCEPTED_IMAGE_EXT;
  if (!accepted.includes(e)) {
    throw new AppError(
      `Unsupported file for ${file.kind}: ${file.filename}. Accepted: ${accepted.join(", ")}.`,
      "unsupported_asset_format",
      400,
    );
  }
  if (file.bytes.byteLength === 0) throw new AppError(`${file.filename} is empty.`, "empty_asset", 400);
  if (file.bytes.byteLength > MAX_ASSET_BYTES) {
    throw new AppError(
      `${file.filename} is too large (max ${MAX_ASSET_BYTES / (1024 * 1024)}MB).`,
      "asset_too_large",
      400,
    );
  }
}

function assetStoragePath(accountId: string, kind: AssetKind, filename: string): string {
  const base = (filename.split(/[/\\]/).pop() ?? filename).replace(/\s+/g, "-");
  return `${accountId}/${kind}/${Date.now()}-${base}`;
}

export interface UploadedAsset {
  id: string;
  kind: AssetKind;
  storagePath: string;
  logo?: LogoProcessing;
  teamMemberId?: string;
}

/**
 * Validate → store → record each uploaded asset. Validates ALL files before
 * writing any, so a bad file fails the batch cleanly (mirrors `storeDocs`). Each
 * file becomes an `assets` row; the logo's processing (background, dominant
 * colour, variant plan) is stored on `metadata_json` and returned so the UI can
 * show the light/dark default + accent swatch. Team photos also create a
 * `team_members` row linked to the asset.
 */
export async function uploadAssetsForUser(deps: AssetDeps, files: AssetFileInput[]): Promise<{ assets: UploadedAsset[] }> {
  if (files.length === 0) throw new AppError("No files provided.", "no_assets", 400);
  files.forEach(validate);

  const { accountId, orderId } = await resolveAccountAndOrder(deps.rls, deps.userId);
  const brandColors = await readBrandColors(deps.rls, orderId);

  const out: UploadedAsset[] = [];
  let teamOrder = await nextTeamOrderIndex(deps.rls, accountId);

  for (const file of files) {
    const storagePath = assetStoragePath(accountId, file.kind, file.filename);
    const { error: upErr } = await deps.admin.storage
      .from(ASSETS_BUCKET)
      .upload(storagePath, file.bytes as Uint8Array, { upsert: false });
    if (upErr) throw new AppError("Upload failed. Please try again.", "asset_upload_failed", 502);

    const logo = file.kind === "logo" ? processLogo(file.filename, file.bytes, brandColors) : undefined;

    const { data: assetRow, error: rowErr } = await deps.rls
      .from("assets")
      .insert({
        account_id: accountId,
        type: DB_TYPE[file.kind],
        storage_path: storagePath,
        original_filename: file.filename,
        metadata_json: (logo ?? null) as Database["public"]["Tables"]["assets"]["Insert"]["metadata_json"],
      })
      .select("id")
      .single();
    if (rowErr) throw rowErr;
    const assetId = (assetRow as { id: string }).id;

    const uploaded: UploadedAsset = { id: assetId, kind: file.kind, storagePath, logo };

    if (file.kind === "team_photo") {
      const { data: tm, error: tmErr } = await deps.rls
        .from("team_members")
        .insert({
          account_id: accountId,
          name: file.teamMember?.name ?? null,
          title: file.teamMember?.title ?? null,
          photo_asset_id: assetId,
          order_index: teamOrder++,
        })
        .select("id")
        .single();
      if (tmErr) throw tmErr;
      uploaded.teamMemberId = (tm as { id: string }).id;
    }

    out.push(uploaded);
  }

  return { assets: out };
}

async function readBrandColors(client: DbClient, orderId: string): Promise<string[] | null> {
  const { data } = await client
    .from("intake_data")
    .select("structured_intake_json")
    .eq("order_id", orderId)
    .maybeSingle();
  const blob = data?.structured_intake_json as { brandColors?: { value?: string[] | null } } | null;
  return blob?.brandColors?.value ?? null;
}

async function nextTeamOrderIndex(client: DbClient, accountId: string): Promise<number> {
  const { data } = await client
    .from("team_members")
    .select("order_index")
    .eq("account_id", accountId)
    .order("order_index", { ascending: false })
    .limit(1);
  const top = (data as { order_index: number }[] | null)?.[0];
  return top ? top.order_index + 1 : 0;
}
