import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/api/envelope";
import { parseRulesJson, type LoadedRuleset } from "./ruleset";
import { mirrorRuleset, recordViolations } from "./persistence";
import type { Violation } from "./validator";

const MINIMAL_RULES = {
  industry: "ria",
  version: "1.0",
  status: "draft",
  prohibited_terms: [],
  prohibited_content: [],
  required_elements: [],
  required_disclosures: [],
  conditional_rules: [],
  citations: {},
};

function loaded(): LoadedRuleset {
  return {
    industry: "ria",
    version: "1.0",
    rules: parseRulesJson(MINIMAL_RULES),
    rulesMarkdown: "# RIA ruleset markdown",
    footerTemplate: "footer",
    overlays: {},
  };
}

type Recorder = { inserted?: unknown; insertTable?: string };

/** A mock service-role client supporting the select/eq/is/maybeSingle + insert/select/single chains. */
function makeClient(opts: {
  existing?: { id: string } | null;
  insertError?: { message: string } | null;
  insertedRows?: Array<{ id: string }>;
}) {
  const rec: Recorder = {};
  const insertedRows = opts.insertedRows ?? [{ id: "row-1" }];

  function builder(result: { data: unknown; error: unknown }) {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is"]) b[m] = () => b;
    // Mirror real supabase: .single()/.maybeSingle() unwrap to one row; an
    // awaited array-select (.then) yields the full array.
    const single = async () => ({
      data: Array.isArray(result.data) ? (result.data[0] ?? null) : result.data,
      error: result.error,
    });
    b.maybeSingle = single;
    b.single = single;
    b.then = (resolve: (v: unknown) => unknown) => resolve(result);
    return b;
  }

  const client = {
    from(table: string) {
      return {
        select: () => builder({ data: opts.existing ?? null, error: null }),
        insert: (rows: unknown) => {
          rec.inserted = rows;
          rec.insertTable = table;
          return builder({
            data: opts.insertError ? null : insertedRows,
            error: opts.insertError ?? null,
          });
        },
      };
    },
  };

  return { client, rec };
}

const violation = (over: Partial<Violation> = {}): Violation => ({
  ruleId: "guarantee",
  severity: "high",
  fieldPath: "pages[0].sections[0].body",
  description: 'Prohibited term "guaranteed"',
  source: "deterministic",
  ...over,
});

describe("mirrorRuleset", () => {
  it("inserts the active ruleset when it is not yet mirrored", async () => {
    const { client, rec } = makeClient({ existing: null, insertedRows: [{ id: "ruleset-1" }] });
    const result = await mirrorRuleset(client as never, loaded());
    expect(result).toEqual({ id: "ruleset-1", created: true });
    expect(rec.insertTable).toBe("compliance_rulesets");
    expect(rec.inserted).toMatchObject({
      industry: "ria",
      sub_industry: null,
      version: "1.0",
      rules_markdown: "# RIA ruleset markdown",
    });
    expect((rec.inserted as { rules_json: unknown }).rules_json).toBeTruthy();
  });

  it("is a no-op when the version is already mirrored (rulesets are immutable)", async () => {
    const { client, rec } = makeClient({ existing: { id: "existing-1" } });
    const result = await mirrorRuleset(client as never, loaded());
    expect(result).toEqual({ id: "existing-1", created: false });
    expect(rec.inserted).toBeUndefined();
  });

  it("throws an AppError when the insert fails", async () => {
    const { client } = makeClient({ existing: null, insertError: { message: "duplicate key" } });
    await expect(mirrorRuleset(client as never, loaded())).rejects.toBeInstanceOf(AppError);
  });
});

describe("recordViolations", () => {
  it("inserts one row per violation, mapping fields + the ruleset version + order id", async () => {
    const { client, rec } = makeClient({ insertedRows: [{ id: "v1" }, { id: "v2" }] });
    const result = await recordViolations(client as never, {
      orderId: "order-1",
      rulesetVersion: "ria/v1.0",
      violations: [violation(), violation({ ruleId: "crs", fieldPath: "footer.links", source: "deterministic" })],
    });
    expect(result.inserted).toBe(2);
    expect(rec.insertTable).toBe("compliance_violations");
    const rows = rec.inserted as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      order_id: "order-1",
      edit_id: null,
      ruleset_version: "ria/v1.0",
      severity: "high",
      field_path: "pages[0].sections[0].body",
    });
    expect(rows[0].violation_description).toContain("guaranteed");
  });

  it("routes to edit_id when an editId is supplied (edit-chat path)", async () => {
    const { client, rec } = makeClient({ insertedRows: [{ id: "v1" }] });
    await recordViolations(client as never, {
      editId: "edit-9",
      rulesetVersion: "ria/v1.0",
      violations: [violation({ source: "ai" })],
    });
    const rows = rec.inserted as Array<Record<string, unknown>>;
    expect(rows[0]).toMatchObject({ order_id: null, edit_id: "edit-9" });
  });

  it("is a no-op for an empty violation list (no insert call)", async () => {
    const { client, rec } = makeClient({});
    const result = await recordViolations(client as never, {
      orderId: "order-1",
      rulesetVersion: "ria/v1.0",
      violations: [],
    });
    expect(result.inserted).toBe(0);
    expect(rec.inserted).toBeUndefined();
  });

  it("throws an AppError when the insert fails", async () => {
    const { client } = makeClient({ insertError: { message: "boom" } });
    await expect(
      recordViolations(client as never, {
        orderId: "order-1",
        rulesetVersion: "ria/v1.0",
        violations: [violation()],
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
