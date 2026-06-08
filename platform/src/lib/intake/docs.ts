/**
 * Uploaded-document handling (PRD §4.2 no-site path, §4.3 scrape-failure
 * fallback). v1 is TEXT-ONLY — no images are extracted from documents (§4.2).
 *
 * Extraction strategy (decided 2026-06-05, see state/decisions.md):
 *   - .txt / .md  → decoded inline (UTF-8).
 *   - .docx       → text via `mammoth` (Word XML → raw text).
 *   - .pptx       → slide text via `jszip` + the `<a:t>` runs in slideN.xml.
 *   - .pdf        → NOT parsed locally; handed to Gemini natively as an inline
 *                   file part (Gemini reads PDFs, incl. layout, far better than a
 *                   text-layer scrape — and scanned PDFs have no text layer).
 *
 * So `extractDoc` returns a discriminated result: text we extracted ourselves,
 * or a Gemini file part to send with the intake prompt. The intake step (§8.3)
 * concatenates the text and attaches the parts.
 */

import JSZip from "jszip";
import mammoth from "mammoth";

import type { GeminiFilePart } from "@/lib/gemini";

/** The five accepted upload formats (§4.2), extension → MIME type. */
export const ACCEPTED_DOC_FORMATS = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
} as const;

export type DocFormat = keyof typeof ACCEPTED_DOC_FORMATS;

export interface DocInput {
  filename: string;
  bytes: Uint8Array;
}

export type DocExtract =
  | { filename: string; via: "text"; text: string }
  | { filename: string; via: "gemini"; part: GeminiFilePart };

/** Lower-cased extension of a filename (without the dot), or "". */
function extensionOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i === -1 ? "" : filename.slice(i + 1).toLowerCase();
}

/** Map a filename to one of the accepted formats, or null if unsupported. */
export function detectFormat(filename: string): DocFormat | null {
  const ext = extensionOf(filename);
  return ext in ACCEPTED_DOC_FORMATS ? (ext as DocFormat) : null;
}

export function isAcceptedFilename(filename: string): boolean {
  return detectFormat(filename) !== null;
}

/** base64-encode bytes without a data: prefix (Gemini inlineData format). */
function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

/** Pull text out of a .pptx by reading the `<a:t>` runs across all slides. */
async function extractPptxText(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const slideNames = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      const nb = Number(b.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      return na - nb;
    });

  const parts: string[] = [];
  for (const name of slideNames) {
    const xml = await zip.files[name].async("string");
    const runs = xml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g) ?? [];
    for (const run of runs) {
      const inner = run.replace(/<a:t[^>]*>([\s\S]*?)<\/a:t>/, "$1");
      parts.push(decodeXmlEntities(inner));
    }
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** Decode the five predefined XML entities found in OOXML text runs. */
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Extract one uploaded document to either text (txt/md/docx/pptx) or a Gemini
 * file part (pdf). Throws on an unsupported format — the upload route validates
 * formats up front, so reaching here with one is a programmer error.
 */
export async function extractDoc(input: DocInput): Promise<DocExtract> {
  const format = detectFormat(input.filename);
  if (!format) {
    throw new Error(`unsupported document format: ${input.filename}`);
  }

  switch (format) {
    case "txt":
    case "md":
      return {
        filename: input.filename,
        via: "text",
        text: new TextDecoder().decode(input.bytes),
      };
    case "docx": {
      const { value } = await mammoth.extractRawText({
        buffer: Buffer.from(input.bytes),
      });
      return { filename: input.filename, via: "text", text: value };
    }
    case "pptx":
      return {
        filename: input.filename,
        via: "text",
        text: await extractPptxText(input.bytes),
      };
    case "pdf":
      return {
        filename: input.filename,
        via: "gemini",
        part: { mimeType: ACCEPTED_DOC_FORMATS.pdf, data: toBase64(input.bytes) },
      };
  }
}
