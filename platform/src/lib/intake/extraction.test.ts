import { describe, expect, it } from "vitest";

import type { CrawlResult } from "@/lib/firecrawl";
import type { GenerateJSONOptions, GenerateJSONResult } from "@/lib/gemini";
import { processIntake } from "./extraction";
import { roundOneSchema, type RoundOneIntake } from "./schema";

const EMPTY = roundOneSchema.parse({});

/** Fake Gemini that records the options it was called with and returns `data`. */
function fakeGemini(data: RoundOneIntake = EMPTY) {
  const calls: Array<GenerateJSONOptions<RoundOneIntake>> = [];
  return {
    calls,
    gemini: {
      generateJSON: async (
        opts: GenerateJSONOptions<RoundOneIntake>,
      ): Promise<GenerateJSONResult<RoundOneIntake>> => {
        calls.push(opts);
        return {
          data,
          model: "gemini-2.5-flash" as const,
          usage: { inputTokens: 100, outputTokens: 50 },
          costUsd: 0.001,
        };
      },
    },
  };
}

function blob(text: string) {
  const bytes = new TextEncoder().encode(text);
  return { arrayBuffer: async () => bytes.buffer };
}

/**
 * Supabase double: intake_data row read + structured_intake_json upsert, plus a
 * storage `download` that returns the queued doc blobs keyed by path.
 */
function makeClient(
  row: { scrape_result_json?: unknown; uploaded_doc_paths?: string[] | null } | null,
  docBlobs: Record<string, ReturnType<typeof blob>> = {},
) {
  const upserts: Array<Record<string, unknown>> = [];
  const downloaded: string[] = [];
  const client = {
    storage: {
      from() {
        return {
          download: async (path: string) => {
            downloaded.push(path);
            const b = docBlobs[path];
            return b ? { data: b, error: null } : { data: null, error: { message: "missing" } };
          },
        };
      },
    },
    from(table: string) {
      if (table !== "intake_data") throw new Error(`unexpected table ${table}`);
      return {
        select() {
          return {
            eq() {
              return { maybeSingle: async () => ({ data: row, error: null }) };
            },
          };
        },
        upsert: async (payload: Record<string, unknown>) => {
          upserts.push(payload);
          return { data: null, error: null };
        },
      };
    },
  };
  return { client, upserts, downloaded };
}

const scrape: CrawlResult = {
  url: "https://acme.com",
  total: 2,
  pages: [
    { url: "https://acme.com/", markdown: "Acme Advisors — fee-only planning." },
    { url: "https://acme.com/team", markdown: "Jane Doe, CFP." },
  ],
};

describe("processIntake (§8.3)", () => {
  it("feeds scrape content to Gemini and persists structured_intake_json", async () => {
    const filled = roundOneSchema.parse({
      firmName: { value: "Acme Advisors", confidence: 0.9, sources: ["https://acme.com/"] },
    });
    const { client, upserts } = makeClient({ scrape_result_json: scrape, uploaded_doc_paths: null });
    const { gemini, calls } = fakeGemini(filled);

    const result = await processIntake({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: client as any,
      orderId: "order-1",
      gemini,
    });

    // Routed to the intake use case + budget.
    expect(calls[0].useCase).toBe("intake");
    expect(calls[0].operation).toBe("intake_extraction");
    // Scrape markdown made it into the prompt, no PDF parts.
    expect(calls[0].prompt).toContain("Acme Advisors — fee-only planning.");
    expect(calls[0].prompt).toContain("WEBSITE CONTENT");
    expect(calls[0].files).toBeUndefined();
    // Persisted exactly what Gemini returned.
    expect(result.firmName.value).toBe("Acme Advisors");
    expect(upserts[0]).toMatchObject({ order_id: "order-1" });
    expect(upserts[0].structured_intake_json).toEqual(filled);
  });

  it("extracts text docs into the prompt and sends PDFs as file parts (§4.2)", async () => {
    const { client, downloaded } = makeClient(
      { scrape_result_json: null, uploaded_doc_paths: ["order-1/about.txt", "order-1/adv.pdf"] },
      {
        "order-1/about.txt": blob("We serve dentists near Boston."),
        "order-1/adv.pdf": blob("%PDF-1.4 fake bytes"),
      },
    );
    const { gemini, calls } = fakeGemini();

    await processIntake({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: client as any,
      orderId: "order-1",
      gemini,
    });

    expect(downloaded).toEqual(["order-1/about.txt", "order-1/adv.pdf"]);
    expect(calls[0].prompt).toContain("uploaded:about.txt");
    expect(calls[0].prompt).toContain("We serve dentists near Boston.");
    expect(calls[0].prompt).toContain("attached as files");
    // The PDF rides along as an inline file part, not as text.
    expect(calls[0].files).toHaveLength(1);
    expect(calls[0].files?.[0].mimeType).toBe("application/pdf");
  });

  it("handles no source material (empty row) without throwing", async () => {
    const { client, upserts } = makeClient(null);
    const { gemini, calls } = fakeGemini();

    await processIntake({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: client as any,
      orderId: "order-1",
      gemini,
    });

    expect(calls[0].prompt).toContain("No source material");
    expect(calls[0].files).toBeUndefined();
    expect(upserts).toHaveLength(1);
  });

  it("skips a doc that fails to download but still processes the rest", async () => {
    const { client } = makeClient(
      { scrape_result_json: null, uploaded_doc_paths: ["order-1/gone.txt", "order-1/here.md"] },
      { "order-1/here.md": blob("# Here") },
    );
    const { gemini, calls } = fakeGemini();

    await processIntake({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: client as any,
      orderId: "order-1",
      gemini,
    });

    expect(calls[0].prompt).toContain("uploaded:here.md");
    expect(calls[0].prompt).not.toContain("uploaded:gone.txt");
  });
});
