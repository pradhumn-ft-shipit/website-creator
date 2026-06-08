/**
 * intake.process (PRD §4.1 step 10, §4.2, §8.3, §9.2) — the IO body the
 * pipeline's intake step runs. Reads whatever the scrape + docs-upload paths
 * produced (`scrape_result_json`, `uploaded_doc_paths`), feeds it to Gemini
 * (Flash, `intake` use case), and writes the structured Round-1 fields with
 * confidence + sources into `structured_intake_json`.
 *
 * Both onboarding paths converge here (§4.2): a sufficient scrape, uploaded
 * docs, or both. Text-based docs (txt/md/docx/pptx) are extracted locally and
 * concatenated into the prompt; PDFs ride along as native Gemini file parts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import type { CrawlResult } from "@/lib/firecrawl";
import {
  CostAccumulator,
  geminiClient,
  type GeminiFilePart,
  type GenerateJSONOptions,
  type GenerateJSONResult,
} from "@/lib/gemini";

import { extractDoc } from "./docs";
import { roundOneSchema, type RoundOneIntake } from "./schema";
import { DOCS_BUCKET } from "./upload";

type AdminClient = SupabaseClient<Database>;

const SYSTEM_INSTRUCTION =
  "You extract structured facts about a financial-advisory (RIA) firm from its " +
  "website content and uploaded documents. Extract ONLY what is stated or " +
  "clearly implied — never invent facts. For every field, set a confidence from " +
  "0 (not found) to 1 (explicitly stated) and list the sources (page URLs or " +
  "'uploaded:<filename>') the value came from. Respond with JSON only.";

/**
 * The one Gemini capability intake needs, specialised to the Round-1 schema. The
 * real `GeminiClient.generateJSON` (generic over T) is assignable to this, and a
 * test fake only has to implement this one concrete signature.
 */
export type IntakeGemini = {
  generateJSON(
    opts: GenerateJSONOptions<RoundOneIntake>,
  ): Promise<GenerateJSONResult<RoundOneIntake>>;
};

export interface ProcessIntakeDeps {
  client: AdminClient;
  orderId: string;
  /** Injectable for tests; defaults to an env-wired client with a $2 cost guard. */
  gemini?: IntakeGemini;
}

interface IntakeRow {
  scrape_result_json: unknown;
  uploaded_doc_paths: string[] | null;
}

async function readIntakeRow(
  client: AdminClient,
  orderId: string,
): Promise<IntakeRow | null> {
  const { data } = await client
    .from("intake_data")
    .select("scrape_result_json, uploaded_doc_paths")
    .eq("order_id", orderId)
    .maybeSingle();
  return (data as IntakeRow | null) ?? null;
}

/** Render scraped pages as labelled markdown blocks for the prompt. */
function scrapeToText(scrape: unknown): string {
  const result = scrape as CrawlResult | null;
  if (!result?.pages?.length) return "";
  return result.pages
    .map((p) => `--- PAGE: ${p.url} ---\n${p.markdown ?? ""}`)
    .join("\n\n");
}

/** Download + extract every uploaded doc into prompt text and Gemini file parts. */
async function gatherDocs(
  client: AdminClient,
  paths: string[],
): Promise<{ text: string; files: GeminiFilePart[] }> {
  const textBlocks: string[] = [];
  const files: GeminiFilePart[] = [];

  for (const path of paths) {
    const { data, error } = await client.storage.from(DOCS_BUCKET).download(path);
    if (error || !data) continue; // best-effort: a missing object shouldn't fail intake
    const bytes = new Uint8Array(await data.arrayBuffer());
    const filename = path.split("/").pop() ?? path;
    const extracted = await extractDoc({ filename, bytes });
    if (extracted.via === "text") {
      textBlocks.push(`--- DOCUMENT: uploaded:${filename} ---\n${extracted.text}`);
    } else {
      files.push(extracted.part);
    }
  }

  return { text: textBlocks.join("\n\n"), files };
}

function buildPrompt(scrapeText: string, docsText: string, hasPdfs: boolean): string {
  const sections: string[] = [
    "Extract the Round-1 intake fields for this RIA firm from the material below.",
    "Also extract up to 5 dominant brand colors as hex codes if the styling reveals them.",
  ];
  if (scrapeText) sections.push(`=== WEBSITE CONTENT ===\n${scrapeText}`);
  if (docsText) sections.push(`=== UPLOADED DOCUMENTS ===\n${docsText}`);
  if (hasPdfs) sections.push("Additional PDF documents are attached as files.");
  if (!scrapeText && !docsText && !hasPdfs) {
    sections.push("(No source material was available — return all fields empty.)");
  }
  return sections.join("\n\n");
}

/**
 * Run extraction and persist `structured_intake_json`. Returns the parsed fields
 * so the caller (pipeline) can act on them. A fresh CostAccumulator guards the
 * per-site $2 cap for this call when no client is injected.
 */
export async function processIntake(
  deps: ProcessIntakeDeps,
): Promise<RoundOneIntake> {
  const { client, orderId } = deps;
  const row = await readIntakeRow(client, orderId);

  const scrapeText = scrapeToText(row?.scrape_result_json);
  const { text: docsText, files } = await gatherDocs(
    client,
    row?.uploaded_doc_paths ?? [],
  );

  const gemini =
    deps.gemini ?? geminiClient({ costAccumulator: new CostAccumulator() });

  const { data } = await gemini.generateJSON({
    useCase: "intake",
    operation: "intake_extraction",
    schema: roundOneSchema,
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt: buildPrompt(scrapeText, docsText, files.length > 0),
    files: files.length > 0 ? files : undefined,
  });

  await client
    .from("intake_data")
    .upsert(
      {
        order_id: orderId,
        structured_intake_json:
          data as unknown as Database["public"]["Tables"]["intake_data"]["Insert"]["structured_intake_json"],
      },
      { onConflict: "order_id" },
    );

  return data;
}
