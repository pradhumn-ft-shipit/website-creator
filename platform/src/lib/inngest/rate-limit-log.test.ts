import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { formatRateLimitEntry, appendRateLimitLog } from "./rate-limit-log";

describe("formatRateLimitEntry", () => {
  it("renders a one-line markdown entry with all fields", () => {
    const line = formatRateLimitEntry({
      service: "gemini",
      endpoint: "generateContent",
      timestamp: "2026-05-31T00:00:00.000Z",
      code: "429",
      fallback: "Inngest backoff + retry",
    });
    expect(line).toContain("gemini");
    expect(line).toContain("generateContent");
    expect(line).toContain("2026-05-31T00:00:00.000Z");
    expect(line).toContain("429");
    expect(line).toContain("Inngest backoff + retry");
  });
});

describe("appendRateLimitLog", () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "rl-"));
    file = join(dir, "rate-limits.md");
    writeFileSync(file, "# Rate Limits Log\n\n_No entries yet._\n");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("appends an entry to the target file", async () => {
    await appendRateLimitLog(
      {
        service: "gemini",
        endpoint: "generateContent",
        timestamp: "2026-05-31T00:00:00.000Z",
        code: "429",
        fallback: "Inngest backoff + retry",
      },
      file,
    );
    const contents = readFileSync(file, "utf8");
    expect(contents).toContain("gemini");
    expect(contents).toContain("429");
  });
});
