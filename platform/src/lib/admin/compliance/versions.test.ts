import { describe, expect, it } from "vitest";

import {
  countLiveSitesByVersion,
  flattenAffectedRows,
  shapeVersions,
  type AffectedRow,
} from "./versions";

describe("flattenAffectedRows", () => {
  it("flattens the embedded generated_content → order → account → sites shape", () => {
    const rows = [
      {
        compliance_version_used: "ria/v1.0",
        order: { account: { sites: [{ id: "site-a", last_deployed_at: "2026-06-01T00:00:00Z" }] } },
      },
      {
        compliance_version_used: "ria/v1.0",
        // un-renamed embed shape (orders/accounts) — also tolerated
        orders: { accounts: { sites: [{ id: "site-b", last_deployed_at: null }] } },
      },
    ];
    const flat = flattenAffectedRows(rows);
    expect(flat).toEqual([
      { versionString: "ria/v1.0", siteId: "site-a", live: true },
      { versionString: "ria/v1.0", siteId: "site-b", live: false },
    ]);
  });

  it("skips rows with no version or no site", () => {
    expect(flattenAffectedRows([{ compliance_version_used: null }, { order: {} }])).toEqual([]);
  });
});

describe("countLiveSitesByVersion", () => {
  it("counts DISTINCT live sites per version and ignores non-live", () => {
    const rows: AffectedRow[] = [
      { versionString: "ria/v1.0", siteId: "s1", live: true },
      { versionString: "ria/v1.0", siteId: "s1", live: true }, // same site, dedup
      { versionString: "ria/v1.0", siteId: "s2", live: true },
      { versionString: "ria/v1.0", siteId: "s3", live: false }, // not live
      { versionString: "ria/v1.1", siteId: "s4", live: true },
    ];
    expect(countLiveSitesByVersion(rows)).toEqual({ "ria/v1.0": 2, "ria/v1.1": 1 });
  });

  it("returns an empty map when nothing is live", () => {
    expect(countLiveSitesByVersion([{ versionString: "ria/v1.0", siteId: "s1", live: false }])).toEqual({});
  });
});

describe("shapeVersions", () => {
  it("merges disk versions, publish rows, and affected counts, newest first", () => {
    const rows = shapeVersions(
      [
        { industry: "ria", version: "1.0", status: "approved", approved: true, reviewers: ["a@w.com", "b@w.com"] },
        { industry: "ria", version: "1.1", status: "draft", approved: false, reviewers: [] },
      ],
      [{ industry: "ria", version: "1.0", publishedAt: "2026-06-01T00:00:00Z" }],
      { "ria/v1.0": 12 },
    );
    expect(rows.map((r) => r.versionString)).toEqual(["ria/v1.1", "ria/v1.0"]);
    const v10 = rows.find((r) => r.version === "1.0")!;
    expect(v10).toMatchObject({ published: true, publishedAt: "2026-06-01T00:00:00Z", affectedSiteCount: 12, approved: true });
    const v11 = rows.find((r) => r.version === "1.1")!;
    expect(v11).toMatchObject({ published: false, affectedSiteCount: 0, status: "draft" });
  });
});
