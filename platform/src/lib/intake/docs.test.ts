import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import {
  ACCEPTED_DOC_FORMATS,
  detectFormat,
  extractDoc,
  isAcceptedFilename,
} from "./docs";

function bytesOf(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/** Build a minimal mammoth-parseable .docx containing the given paragraph. */
async function makeDocx(text: string): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`,
  );
  return zip.generateAsync({ type: "uint8array" });
}

/** Build a minimal .pptx with two slides carrying <a:t> text runs. */
async function makePptx(slides: string[][]): Promise<Uint8Array> {
  const zip = new JSZip();
  slides.forEach((runs, i) => {
    const body = runs.map((r) => `<a:p><a:r><a:t>${r}</a:t></a:r></a:p>`).join("");
    zip.file(`ppt/slides/slide${i + 1}.xml`, `<?xml version="1.0"?><root>${body}</root>`);
  });
  return zip.generateAsync({ type: "uint8array" });
}

describe("format detection (§4.2 — five accepted formats)", () => {
  it("recognises all five formats case-insensitively", () => {
    for (const ext of Object.keys(ACCEPTED_DOC_FORMATS)) {
      expect(detectFormat(`brochure.${ext.toUpperCase()}`)).toBe(ext);
      expect(isAcceptedFilename(`a.${ext}`)).toBe(true);
    }
  });

  it("rejects unsupported formats", () => {
    expect(detectFormat("photo.png")).toBeNull();
    expect(detectFormat("noextension")).toBeNull();
    expect(isAcceptedFilename("evil.exe")).toBe(false);
  });
});

describe("extractDoc (§4.2 text-only)", () => {
  it("decodes .txt and .md inline", async () => {
    const txt = await extractDoc({ filename: "a.txt", bytes: bytesOf("plain text body") });
    expect(txt).toEqual({ filename: "a.txt", via: "text", text: "plain text body" });

    const md = await extractDoc({ filename: "a.md", bytes: bytesOf("# Heading\nbody") });
    expect(md.via).toBe("text");
    if (md.via === "text") expect(md.text).toContain("Heading");
  });

  it("extracts raw text from a .docx via mammoth", async () => {
    const docx = await makeDocx("Hello from DOCX");
    const result = await extractDoc({ filename: "firm.docx", bytes: docx });
    expect(result.via).toBe("text");
    if (result.via === "text") expect(result.text).toContain("Hello from DOCX");
  });

  it("extracts slide text from a .pptx in slide order", async () => {
    const pptx = await makePptx([
      ["We are", "Acme Advisors"],
      ["Fiduciary & fee-only"],
    ]);
    const result = await extractDoc({ filename: "deck.pptx", bytes: pptx });
    expect(result.via).toBe("text");
    if (result.via === "text") {
      expect(result.text).toBe("We are Acme Advisors Fiduciary & fee-only");
    }
  });

  it("hands a .pdf to Gemini as an inline file part (not parsed locally)", async () => {
    const bytes = bytesOf("%PDF-1.4 fake");
    const result = await extractDoc({ filename: "adv.pdf", bytes });
    expect(result.via).toBe("gemini");
    if (result.via === "gemini") {
      expect(result.part.mimeType).toBe("application/pdf");
      expect(result.part.data).toBe(Buffer.from(bytes).toString("base64"));
    }
  });

  it("throws on an unsupported format (route validates first)", async () => {
    await expect(
      extractDoc({ filename: "x.png", bytes: bytesOf("x") }),
    ).rejects.toThrow(/unsupported/);
  });
});
