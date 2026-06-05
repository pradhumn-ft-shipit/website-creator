import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

function req() {
  return new Request("http://localhost/api/dev/compliance-check");
}

describe("GET /api/dev/compliance-check", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", ""); // force deterministic-only (offline) path
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 404 in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await GET(req(), undefined);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("not_found");
  });

  it("passes the clean fixture and fails the bad fixture with ≥2 violations", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const res = await GET(req(), undefined);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error).toBeNull();

    expect(body.data.rulesetVersion).toBe("ria/v1.0");
    expect(body.data.aiPassRan).toBe(false);

    // Clean site → pass, zero violations.
    expect(body.data.clean.verdict).toBe("pass");
    expect(body.data.clean.violationCount).toBe(0);

    // Bad site → fail with at least the guarantee term + the missing CRS link.
    expect(body.data.bad.verdict).toBe("fail");
    expect(body.data.bad.violationCount).toBeGreaterThanOrEqual(2);
    const ruleIds = body.data.bad.violations.map((v: { ruleId: string }) => v.ruleId);
    expect(ruleIds).toContain("guarantee");
    expect(ruleIds).toContain("crs");
  });
});
