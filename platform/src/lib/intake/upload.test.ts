import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/api/envelope";
import {
  DOCS_BUCKET,
  MAX_DOC_BYTES,
  docStoragePath,
  storeDocs,
  validateUpload,
} from "./upload";

function bytes(n: number): Uint8Array {
  return new Uint8Array(n).fill(120);
}

/** Supabase double: records storage uploads + the intake_data upsert. */
function makeClient(existingPaths: string[] | null = null, uploadError = false) {
  const uploads: Array<{ bucket: string; path: string; contentType?: string }> = [];
  const upserts: Array<Record<string, unknown>> = [];
  const state = { paths: existingPaths };

  const client = {
    storage: {
      from(bucket: string) {
        return {
          upload: async (
            path: string,
            _body: unknown,
            opts?: { contentType?: string },
          ) => {
            uploads.push({ bucket, path, contentType: opts?.contentType });
            return uploadError
              ? { data: null, error: { message: "boom" } }
              : { data: { path }, error: null };
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
              return {
                maybeSingle: async () => ({
                  data: state.paths ? { uploaded_doc_paths: state.paths } : null,
                  error: null,
                }),
              };
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
  return { client, uploads, upserts };
}

describe("validateUpload", () => {
  it("accepts a known format under the size cap", () => {
    expect(() => validateUpload({ filename: "a.pdf", bytes: bytes(10) })).not.toThrow();
  });

  it("rejects an unsupported format with a user-safe AppError", () => {
    try {
      validateUpload({ filename: "a.png", bytes: bytes(10) });
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe("unsupported_doc_format");
    }
  });

  it("rejects empty and oversized files", () => {
    expect(() => validateUpload({ filename: "a.pdf", bytes: bytes(0) })).toThrow(
      /empty/i,
    );
    expect(() =>
      validateUpload({ filename: "a.pdf", bytes: bytes(MAX_DOC_BYTES + 1) }),
    ).toThrow(/too large/i);
  });
});

describe("docStoragePath", () => {
  it("namespaces by order and strips path components", () => {
    expect(docStoragePath("order-1", "../../etc/passwd.txt")).toBe(
      "order-1/passwd.txt",
    );
  });
});

describe("storeDocs", () => {
  it("validates, uploads to the private bucket, and records paths", async () => {
    const { client, uploads, upserts } = makeClient();
    const result = await storeDocs({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: client as any,
      orderId: "order-1",
      files: [
        { filename: "brochure.pdf", bytes: bytes(100) },
        { filename: "about.docx", bytes: bytes(100) },
      ],
    });

    expect(uploads.map((u) => u.bucket)).toEqual([DOCS_BUCKET, DOCS_BUCKET]);
    expect(uploads[0].path).toBe("order-1/brochure.pdf");
    expect(uploads[0].contentType).toBe("application/pdf");
    expect(result.paths).toEqual(["order-1/brochure.pdf", "order-1/about.docx"]);
    expect(upserts[0].uploaded_doc_paths).toEqual(result.paths);
  });

  it("appends to existing paths and dedupes (multi-upload)", async () => {
    const { client } = makeClient(["order-1/brochure.pdf"]);
    const result = await storeDocs({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: client as any,
      orderId: "order-1",
      files: [
        { filename: "brochure.pdf", bytes: bytes(100) }, // dup
        { filename: "deck.pptx", bytes: bytes(100) }, // new
      ],
    });
    expect(result.paths).toEqual(["order-1/brochure.pdf", "order-1/deck.pptx"]);
  });

  it("fails the whole batch if any file is invalid (validate before write)", async () => {
    const { client, uploads } = makeClient();
    await expect(
      storeDocs({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client: client as any,
        orderId: "order-1",
        files: [
          { filename: "ok.pdf", bytes: bytes(100) },
          { filename: "bad.png", bytes: bytes(100) },
        ],
      }),
    ).rejects.toBeInstanceOf(AppError);
    expect(uploads).toHaveLength(0); // nothing written
  });

  it("rejects an empty file list", async () => {
    const { client } = makeClient();
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      storeDocs({ client: client as any, orderId: "order-1", files: [] }),
    ).rejects.toThrow(/no files/i);
  });

  it("surfaces a storage upload failure as an AppError", async () => {
    const { client } = makeClient(null, true);
    await expect(
      storeDocs({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client: client as any,
        orderId: "order-1",
        files: [{ filename: "a.pdf", bytes: bytes(100) }],
      }),
    ).rejects.toMatchObject({ code: "doc_upload_failed" });
  });
});
