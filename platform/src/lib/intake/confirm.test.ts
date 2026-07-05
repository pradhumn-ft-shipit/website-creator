import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/api/envelope";
import {
  deriveSubIndustry,
  mergeRoundOneCorrections,
  readIntakeForConfirm,
  saveQuickQuestions,
  saveRoundOneCorrections,
  saveRoundTwo,
  STATE_OVERLAYS,
} from "./confirm";

// ---- fake Supabase --------------------------------------------------------

type Rows = {
  account: { id: string; firm_name?: string | null; sub_industry?: string | null; primary_state?: string | null; crd_number?: string | null } | null;
  order: { id: string } | null;
  intake: { structured_intake_json: unknown } | null;
};

/**
 * A minimal chainable Supabase double. Records the last update/upsert payload
 * per table so tests can assert what was written, and returns the configured
 * rows for reads.
 */
function makeClient(rows: Rows) {
  const writes: { accountUpdate?: Record<string, unknown>; intakeUpsert?: Record<string, unknown> } = {};
  const client = {
    from(table: string) {
      if (table === "accounts") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: rows.account, error: null }) }) }),
          update: (payload: Record<string, unknown>) => {
            writes.accountUpdate = payload;
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      if (table === "orders") {
        return {
          select: () => ({
            eq: () => ({ order: () => ({ limit: async () => ({ data: rows.order ? [rows.order] : [], error: null }) }) }),
          }),
        };
      }
      if (table === "intake_data") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: rows.intake, error: null }) }) }),
          upsert: async (payload: Record<string, unknown>) => {
            writes.intakeUpsert = payload;
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  return { client: client as never, writes };
}

const OWNED: Pick<Rows, "account" | "order"> = {
  account: { id: "acc-1", firm_name: "Meridian" },
  order: { id: "ord-1" },
};

// ---- pure core ------------------------------------------------------------

describe("deriveSubIndustry (§5.5)", () => {
  it("maps ≥ $100M to SEC-registered, no state overlay", () => {
    expect(deriveSubIndustry("over_100m")).toEqual({ subIndustry: "ria_sec", needsStateOverlay: false });
  });
  it("maps < $100M to state-registered and triggers the state overlay", () => {
    expect(deriveSubIndustry("under_100m")).toEqual({ subIndustry: "ria_state", needsStateOverlay: true });
  });
  it("ships overlays for the top-10 states", () => {
    expect(STATE_OVERLAYS).toContain("CA");
    expect(STATE_OVERLAYS).toHaveLength(10);
  });
});

describe("mergeRoundOneCorrections", () => {
  it("marks a corrected field advisor-confirmed (confidence 1) without mutating input", () => {
    const extracted = { firmName: { value: "Guess Co", confidence: 0.4, sources: ["/"] } };
    const merged = mergeRoundOneCorrections(extracted, [{ field: "firmName", value: "Meridian Wealth" }]);
    expect(merged.firmName).toEqual({ value: "Meridian Wealth", confidence: 1, sources: ["advisor"] });
    // input untouched
    expect(extracted.firmName.value).toBe("Guess Co");
  });
  it("leaves untouched fields alone and ignores unknown keys", () => {
    const extracted = { yearFounded: { value: 2011, confidence: 0.9, sources: [] } };
    const merged = mergeRoundOneCorrections(extracted, [{ field: "bogus" as never, value: "x" }]);
    expect(merged).toEqual(extracted);
  });
});

// ---- IO -------------------------------------------------------------------

describe("saveQuickQuestions (§4.1.8, §5.5)", () => {
  it("derives sub_industry from AUM and writes it to the account", async () => {
    const { client, writes } = makeClient({ ...OWNED, intake: null });
    const res = await saveQuickQuestions({ client, userId: "u1" }, { aumBucket: "over_100m", custodian: "Schwab" });
    expect(res.subIndustry).toBe("ria_sec");
    expect(writes.accountUpdate).toMatchObject({ sub_industry: "ria_sec" });
    // custodian folded into the intake blob as a confirmed field
    expect((writes.intakeUpsert?.structured_intake_json as Record<string, unknown>).custodian).toEqual({
      value: "Schwab",
      confidence: 1,
      sources: ["advisor"],
    });
  });

  it("requires a primary state on the < $100M branch", async () => {
    const { client } = makeClient({ ...OWNED, intake: null });
    await expect(
      saveQuickQuestions({ client, userId: "u1" }, { aumBucket: "under_100m" }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("persists state + CRD on the state-registered branch", async () => {
    const { client, writes } = makeClient({ ...OWNED, intake: null });
    await saveQuickQuestions(
      { client, userId: "u1" },
      { aumBucket: "under_100m", primaryState: "CA", crdNumber: "123456" },
    );
    expect(writes.accountUpdate).toMatchObject({ sub_industry: "ria_state", primary_state: "CA", crd_number: "123456" });
  });
});

describe("saveRoundOneCorrections (§4.1.10)", () => {
  it("merges corrections into the existing blob", async () => {
    const { client, writes } = makeClient({
      ...OWNED,
      intake: { structured_intake_json: { teamSize: { value: 3, confidence: 0.5, sources: [] } } },
    });
    await saveRoundOneCorrections({ client, userId: "u1" }, [{ field: "teamSize", value: 7 }]);
    const blob = writes.intakeUpsert?.structured_intake_json as Record<string, { value: unknown }>;
    expect(blob.teamSize.value).toBe(7);
  });
});

describe("saveRoundTwo (§4.1.12)", () => {
  it("stores round-2 answers under the roundTwo key, merging with prior answers", async () => {
    const { client, writes } = makeClient({
      ...OWNED,
      intake: { structured_intake_json: { roundTwo: { blog: true } } },
    });
    await saveRoundTwo({ client, userId: "u1" }, { differentiator: "Fee-only for founders", displayFees: false });
    const blob = writes.intakeUpsert?.structured_intake_json as { roundTwo: Record<string, unknown> };
    expect(blob.roundTwo).toEqual({ blog: true, differentiator: "Fee-only for founders", displayFees: false });
  });
});

describe("readIntakeForConfirm", () => {
  it("returns the blob plus account identity facts", async () => {
    const { client } = makeClient({
      account: { id: "acc-1", firm_name: "Meridian", sub_industry: "ria_sec", primary_state: null, crd_number: null },
      order: { id: "ord-1" },
      intake: { structured_intake_json: { firmName: { value: "Meridian", confidence: 0.98, sources: ["/"] } } },
    });
    const view = await readIntakeForConfirm({ client, userId: "u1" });
    expect(view.firmName).toBe("Meridian");
    expect(view.subIndustry).toBe("ria_sec");
    expect((view.intake.firmName as { value: string }).value).toBe("Meridian");
  });

  it("throws when the order hasn't been created yet", async () => {
    const { client } = makeClient({ account: { id: "acc-1" }, order: null, intake: null });
    await expect(readIntakeForConfirm({ client, userId: "u1" })).rejects.toBeInstanceOf(AppError);
  });
});
