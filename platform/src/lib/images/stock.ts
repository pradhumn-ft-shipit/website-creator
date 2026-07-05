/**
 * Stock image search (PRD §6.7) — Unsplash + Pexels, both licensed for
 * commercial use with no attribution required. This is the FIRST source the
 * pipeline tries for any unfilled image slot; only on a stock miss does it fall
 * back to capped AI generation.
 *
 * Both providers need live API keys (Unsplash access key, Pexels API key). The
 * client is key-gated: with no keys it returns no candidates (a clean miss), so
 * the whole feature degrades gracefully behind env config — matching how 008/012
 * wired real clients but tested against a mocked boundary. All failures are
 * best-effort: a provider error is a miss, never a thrown pipeline failure.
 */

import type { StockProvider } from "./credits";

/** Minimal structural slice of `fetch` this module depends on (injectable). */
export type StockHttp = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  json?: () => Promise<unknown>;
  arrayBuffer?: () => Promise<ArrayBuffer>;
  headers?: { get(name: string): string | null };
}>;

export interface StockCandidate {
  provider: StockProvider;
  /** Provider photo id. */
  id: string;
  photographer: string;
  /** Human-facing photo page (for the credits file). */
  sourceUrl: string;
  /** Direct image URL to download. */
  downloadUrl: string;
  /** Provider-supplied description → WCAG alt text (§6.6). */
  altText: string;
}

export interface StockSearchDeps {
  http?: StockHttp;
  unsplashKey?: string;
  pexelsKey?: string;
  /** Max candidates to return per provider. Default 3. */
  perProvider?: number;
}

const UNSPLASH_API = "https://api.unsplash.com/search/photos";
const PEXELS_API = "https://api.pexels.com/v1/search";

function envDeps(): Pick<StockSearchDeps, "unsplashKey" | "pexelsKey"> {
  return {
    unsplashKey: process.env.UNSPLASH_ACCESS_KEY,
    pexelsKey: process.env.PEXELS_API_KEY,
  };
}

async function searchUnsplash(
  http: StockHttp,
  key: string,
  query: string,
  perPage: number,
): Promise<StockCandidate[]> {
  try {
    const url = `${UNSPLASH_API}?query=${encodeURIComponent(query)}&per_page=${perPage}&content_filter=high&orientation=landscape`;
    const res = await http(url, { headers: { Authorization: `Client-ID ${key}` } });
    if (!res.ok || !res.json) return [];
    const body = (await res.json()) as {
      results?: Array<{
        id?: string;
        alt_description?: string | null;
        urls?: { regular?: string };
        links?: { html?: string };
        user?: { name?: string };
      }>;
    };
    return (body.results ?? [])
      .filter((r) => r.urls?.regular)
      .map((r) => ({
        provider: "unsplash" as const,
        id: String(r.id ?? ""),
        photographer: r.user?.name ?? "Unknown",
        sourceUrl: r.links?.html ?? "https://unsplash.com",
        downloadUrl: r.urls!.regular!,
        altText: r.alt_description ?? "Decorative background image",
      }));
  } catch {
    return []; // best-effort: a provider error is a stock miss, not a failure
  }
}

async function searchPexels(
  http: StockHttp,
  key: string,
  query: string,
  perPage: number,
): Promise<StockCandidate[]> {
  try {
    const url = `${PEXELS_API}?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`;
    const res = await http(url, { headers: { Authorization: key } });
    if (!res.ok || !res.json) return [];
    const body = (await res.json()) as {
      photos?: Array<{
        id?: number;
        alt?: string | null;
        url?: string;
        src?: { large?: string };
        photographer?: string;
      }>;
    };
    return (body.photos ?? [])
      .filter((p) => p.src?.large)
      .map((p) => ({
        provider: "pexels" as const,
        id: String(p.id ?? ""),
        photographer: p.photographer ?? "Unknown",
        sourceUrl: p.url ?? "https://pexels.com",
        downloadUrl: p.src!.large!,
        altText: p.alt ?? "Decorative background image",
      }));
  } catch {
    return [];
  }
}

/**
 * Search stock providers for a query. Returns candidates from every configured
 * provider (Unsplash first, then Pexels). No keys → no candidates (a clean miss
 * that routes the slot to AI fallback). Never throws.
 */
export async function searchStock(
  query: string,
  deps: StockSearchDeps = {},
): Promise<StockCandidate[]> {
  const env = envDeps();
  const unsplashKey = deps.unsplashKey ?? env.unsplashKey;
  const pexelsKey = deps.pexelsKey ?? env.pexelsKey;
  const perProvider = deps.perProvider ?? 3;

  if (!unsplashKey && !pexelsKey) return [];
  const http = deps.http ?? (globalThis.fetch as unknown as StockHttp);

  const results: StockCandidate[] = [];
  if (unsplashKey) {
    results.push(...(await searchUnsplash(http, unsplashKey, query, perProvider)));
  }
  if (pexelsKey) {
    results.push(...(await searchPexels(http, pexelsKey, query, perProvider)));
  }
  return results;
}

/** base64-encode raw bytes without pulling in Buffer typing at the edge. */
function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  // btoa exists in the Node/Edge runtimes this project targets.
  return btoa(binary);
}

/**
 * Download a chosen stock image to base64 bytes so it can be stored + committed
 * into the site repo (rather than hotlinked). Best-effort: returns null on any
 * failure so the resolve step can fall through to AI.
 */
export async function fetchImageBytes(
  url: string,
  http: StockHttp = globalThis.fetch as unknown as StockHttp,
): Promise<{ data: string; mimeType: string } | null> {
  try {
    const res = await http(url);
    if (!res.ok || !res.arrayBuffer) return null;
    const buf = await res.arrayBuffer();
    const mimeType = res.headers?.get("content-type") ?? "image/jpeg";
    return { data: toBase64(buf), mimeType };
  } catch {
    return null;
  }
}
