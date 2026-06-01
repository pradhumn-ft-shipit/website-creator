import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the gemini module so the route test never touches the real SDK or a key.
const generateJSON = vi.fn();
vi.mock("@/lib/gemini", async () => {
  const actual = await vi.importActual<typeof import("@/lib/gemini")>(
    "@/lib/gemini",
  );
  return {
    ...actual,
    geminiClient: () => ({ generateJSON }),
  };
});

import { GET } from "./route";

function req() {
  return new Request("http://localhost/api/dev/gemini-check");
}

describe("GET /api/dev/gemini-check", () => {
  beforeEach(() => {
    generateJSON.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 404 in production (cost-incurring check is hard-disabled)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await GET(req(), undefined);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.data).toBeNull();
    expect(body.error.code).toBe("not_found");
  });

  it("returns usage + cost in the envelope outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    generateJSON.mockResolvedValue({
      model: "gemini-2.5-flash",
      data: { greeting: "hi", ok: true },
      usage: { inputTokens: 40, outputTokens: 12 },
      costUsd: 0.000042,
    });

    const res = await GET(req(), undefined);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error).toBeNull();
    expect(body.data.output).toEqual({ greeting: "hi", ok: true });
    expect(body.data.usage).toEqual({ inputTokens: 40, outputTokens: 12 });
    expect(body.data.model).toBe("gemini-2.5-flash");
    expect(body.data.costUsd).toBeGreaterThan(0);
  });
});
