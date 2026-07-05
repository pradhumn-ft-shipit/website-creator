import { describe, expect, it } from "vitest";

import { planRevalidation, recordRevalidationResult } from "./revalidation";
import type { Violation } from "@/lib/compliance";

const gcRow = (versionString: string, siteId: string, live: boolean) => ({
  compliance_version_used: versionString,
  order: { account: { sites: [{ id: siteId, last_deployed_at: live ? "2026-06-01T00:00:00Z" : null }] } },
});

describe("planRevalidation", () => {
  it("selects live sites built against an older version, dedup by site", () => {
    const rows = [
      gcRow("ria/v1.0", "s1", true),
      gcRow("ria/v1.0", "s1", true), // dup site
      gcRow("ria/v1.0", "s2", true),
      gcRow("ria/v1.1", "s3", true), // already current → skip
      gcRow("ria/v1.0", "s4", false), // not live → skip
    ];
    const targets = planRevalidation(rows, { s1: "o1", s2: "o2", s3: "o3", s4: "o4" }, "ria/v1.1");
    expect(targets.map((t) => t.siteId).sort()).toEqual(["s1", "s2"]);
    expect(targets[0]).toMatchObject({ fromVersion: "ria/v1.0" });
  });

  it("skips sites with no mapped order", () => {
    const targets = planRevalidation([gcRow("ria/v1.0", "s1", true)], {}, "ria/v1.1");
    expect(targets).toEqual([]);
  });
});

function makeClient() {
  const rec: { inserts: Array<{ table: string; row: unknown }> } = { inserts: [] };
  function builder(data: unknown) {
    const b: Record<string, unknown> = {};
    b.select = () => b;
    b.then = (resolve: (v: unknown) => unknown) => resolve({ data, error: null });
    return b;
  }
  const client = {
    from(table: string) {
      return {
        insert: (row: unknown) => {
          rec.inserts.push({ table, row });
          return builder(Array.isArray(row) ? (row as unknown[]).map((_, i) => ({ id: `v${i}` })) : { id: "a1" });
        },
      };
    },
  };
  return { client, rec };
}

const violation = (over: Partial<Violation> = {}): Violation => ({
  ruleId: "guarantee",
  severity: "high",
  fieldPath: "pages[0]",
  description: "Prohibited term",
  source: "deterministic",
  ...over,
});

describe("recordRevalidationResult", () => {
  it("writes violations + a compliance_review alert when a site is flagged (034 queue seam)", async () => {
    const { client, rec } = makeClient();
    const result = await recordRevalidationResult(client as never, {
      siteId: "s1",
      orderId: "o1",
      newVersion: "ria/v1.1",
      violations: [violation(), violation({ severity: "low" })],
    });
    expect(result.flagged).toBe(true);
    expect(result.violations.inserted).toBe(2);
    const tables = rec.inserts.map((i) => i.table);
    expect(tables).toContain("compliance_violations");
    expect(tables).toContain("admin_alerts");
    const alert = rec.inserts.find((i) => i.table === "admin_alerts")!.row as { type: string; payload_json: { severity: string } };
    expect(alert.type).toBe("compliance_review");
    expect(alert.payload_json.severity).toBe("high");
  });

  it("writes nothing for a clean site (no violations)", async () => {
    const { client, rec } = makeClient();
    const result = await recordRevalidationResult(client as never, {
      siteId: "s1", orderId: "o1", newVersion: "ria/v1.1", violations: [],
    });
    expect(result.flagged).toBe(false);
    expect(rec.inserts).toHaveLength(0);
  });
});
