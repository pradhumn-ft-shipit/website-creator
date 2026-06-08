/**
 * Docs-upload storage (PRD §4.2/§4.3). Validates the five accepted formats and a
 * per-file size cap, writes each file to the private `intake-docs` Storage bucket
 * under the order's prefix, and records the object paths in
 * `intake_data.uploaded_doc_paths` (append, never clobber — an advisor may add
 * docs across several uploads).
 *
 * Called by the upload route AFTER it has authenticated the advisor and verified
 * they own the order; this layer is IO-only and uses the service-role client
 * (Storage RLS is bypassed server-side — see the 012 migration).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { AppError } from "@/lib/api/envelope";
import type { Database } from "@/types/database.types";

import { ACCEPTED_DOC_FORMATS, detectFormat } from "./docs";

type AdminClient = SupabaseClient<Database>;

export const DOCS_BUCKET = "intake-docs";
/** Per-file hard cap. Generous for brochures/decks; rejects accidental video etc. */
export const MAX_DOC_BYTES = 25 * 1024 * 1024;

export interface UploadFileInput {
  filename: string;
  bytes: Uint8Array;
}

/** Validate one file's format + size, throwing a user-safe AppError on failure. */
export function validateUpload(file: UploadFileInput): void {
  if (!detectFormat(file.filename)) {
    throw new AppError(
      `Unsupported file type: ${file.filename}. Accepted: PDF, DOCX, TXT, MD, PPTX.`,
      "unsupported_doc_format",
      400,
    );
  }
  if (file.bytes.byteLength === 0) {
    throw new AppError(`${file.filename} is empty.`, "empty_doc", 400);
  }
  if (file.bytes.byteLength > MAX_DOC_BYTES) {
    throw new AppError(
      `${file.filename} is too large (max ${MAX_DOC_BYTES / (1024 * 1024)}MB).`,
      "doc_too_large",
      400,
    );
  }
}

/** Storage object path for an uploaded doc — namespaced by order. */
export function docStoragePath(orderId: string, filename: string): string {
  // Strip any path components a filename might carry; keep just the base name.
  const base = filename.split(/[/\\]/).pop() ?? filename;
  return `${orderId}/${base}`;
}

async function readExistingPaths(
  client: AdminClient,
  orderId: string,
): Promise<string[]> {
  const { data } = await client
    .from("intake_data")
    .select("uploaded_doc_paths")
    .eq("order_id", orderId)
    .maybeSingle();
  return data?.uploaded_doc_paths ?? [];
}

/**
 * Validate, store, and record uploaded docs. Returns the full set of stored
 * paths for the order (existing + newly added). Validates ALL files before
 * writing any, so a bad file in the batch fails the whole upload cleanly.
 */
export async function storeDocs(deps: {
  client: AdminClient;
  orderId: string;
  files: UploadFileInput[];
}): Promise<{ paths: string[] }> {
  const { client, orderId, files } = deps;

  if (files.length === 0) {
    throw new AppError("No files provided.", "no_docs", 400);
  }
  files.forEach(validateUpload);

  const newPaths: string[] = [];
  for (const file of files) {
    const path = docStoragePath(orderId, file.filename);
    const format = detectFormat(file.filename)!;
    const { error } = await client.storage
      .from(DOCS_BUCKET)
      .upload(path, file.bytes, {
        contentType: ACCEPTED_DOC_FORMATS[format],
        upsert: true,
      });
    if (error) {
      throw new AppError(
        `Failed to store ${file.filename}.`,
        "doc_upload_failed",
        502,
      );
    }
    newPaths.push(path);
  }

  // Append (dedupe) onto whatever was already uploaded for this order.
  const existing = await readExistingPaths(client, orderId);
  const merged = Array.from(new Set([...existing, ...newPaths]));
  const { error } = await client
    .from("intake_data")
    .upsert(
      { order_id: orderId, uploaded_doc_paths: merged },
      { onConflict: "order_id" },
    );
  if (error) {
    throw new AppError(
      "Failed to record uploaded documents.",
      "doc_record_failed",
      502,
    );
  }

  return { paths: merged };
}
