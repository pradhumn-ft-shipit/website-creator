/**
 * IapdClient — the one place the iapd.fetch step (014) reaches SEC IAPD
 * (PRD §5.4). Follows the Firecrawl-client pattern (012): a thin structural
 * HTTP boundary is injected so unit tests pass a stub and there is no live
 * call; `iapdClient()` wires the real `fetch`.
 *
 * IAPD is a public SEC data source (adviserinfo.sec.gov) — no API key. Two
 * calls: (1) a firm search by CRD returning the firm's brochure/CRS metadata,
 * (2) a raw PDF download per document. The exact IAPD response shape below is
 * a best-effort mapping of the public search API (not verified against a live
 * response this session — no live IAPD access); it is fully gated behind the
 * injected HTTP boundary, so wiring it to the real endpoint only requires
 * confirming field names once live access is available (same posture as
 * 012's Firecrawl client).
 *
 * Errors: a 429 becomes the retryable `IapdRateLimitError` (009 backs off);
 * everything else (CRD not found, malformed body, 5xx, download failure)
 * becomes `IapdError`, which the service layer treats as "IAPD unavailable"
 * and walks the §5.4 fallback chain (scrape → upload prompt).
 */

import { IapdError, IapdRateLimitError } from "./errors";

const SEARCH_BASE = "https://api.adviserinfo.sec.gov/search/firm";
const REPORTS_BASE = "https://reports.adviserinfo.sec.gov/reports";

/** One compliance document IAPD reports for a firm. */
export interface IapdDocument {
  kind: "adv2a" | "adv2b" | "crs";
  filename: string;
  url: string;
}

export interface IapdFirmRecord {
  crd: string;
  firmName?: string;
  documents: IapdDocument[];
}

/** Minimal structural slice of `fetch`'s Response this client depends on. */
export type IapdHttpResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  arrayBuffer(): Promise<ArrayBuffer>;
};
export type IapdHttpBoundary = (
  input: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<IapdHttpResponse>;

function rateLimited(status: number): boolean {
  return status === 429;
}

/** Raw shape we expect back from the IAPD firm-search endpoint. */
interface IapdSearchResponse {
  hits?: {
    hits?: Array<{
      _source?: {
        firm_crd_nb?: string;
        firm_name?: string;
        brochures?: Array<{
          brochure_id?: string;
          brochure_name?: string;
          /** e.g. "ADV_PART_2A", "ADV_PART_2B", "FORM_CRS" (best-effort). */
          brochure_type?: string;
          pdf_url?: string;
        }>;
      };
    }>;
  };
}

function classify(brochureType: string | undefined): IapdDocument["kind"] | null {
  const t = (brochureType ?? "").toLowerCase();
  if (t.includes("crs")) return "crs";
  if (t.includes("2b")) return "adv2b";
  if (t.includes("2a") || t.includes("brochure")) return "adv2a";
  return null;
}

export class IapdClient {
  constructor(private readonly http: IapdHttpBoundary) {}

  /** Look up a firm's ADV/CRS document metadata by CRD number. */
  async fetchFirmRecord(crd: string): Promise<IapdFirmRecord> {
    const endpoint = `${SEARCH_BASE}?query=${encodeURIComponent(crd)}&hl=true&wt=json`;
    const res = await this.http(endpoint, { method: "GET" });
    if (rateLimited(res.status)) throw new IapdRateLimitError(endpoint);
    if (!res.ok) {
      throw new IapdError(`IAPD search failed (${res.status})`, endpoint, {
        status: res.status,
      });
    }

    const body = (await res.json()) as IapdSearchResponse;
    const hit = body.hits?.hits?.[0]?._source;
    if (!hit) {
      throw new IapdError(`No IAPD firm record found for CRD ${crd}`, endpoint);
    }

    const documents: IapdDocument[] = (hit.brochures ?? []).flatMap((b) => {
      const kind = classify(b.brochure_type);
      if (!kind || !b.brochure_id) return [];
      const url =
        b.pdf_url ?? `${REPORTS_BASE}/ADV/${crd}/PDF/${b.brochure_id}.pdf`;
      return [
        {
          kind,
          filename: `${b.brochure_name ?? kind}-${b.brochure_id}.pdf`,
          url,
        },
      ];
    });

    return { crd, firmName: hit.firm_name, documents };
  }

  /** Download one document's raw PDF bytes. */
  async downloadDocument(doc: IapdDocument): Promise<Uint8Array> {
    const res = await this.http(doc.url, { method: "GET" });
    if (rateLimited(res.status)) throw new IapdRateLimitError(doc.url);
    if (!res.ok) {
      throw new IapdError(
        `Failed to download ${doc.filename} (${res.status})`,
        doc.url,
        { status: res.status },
      );
    }
    return new Uint8Array(await res.arrayBuffer());
  }
}

let singleton: IapdClient | undefined;

/** The real, fetch-wired client. Memoised; no API key (IAPD is public data). */
export function iapdClient(): IapdClient {
  if (!singleton) singleton = new IapdClient(globalThis.fetch as unknown as IapdHttpBoundary);
  return singleton;
}
