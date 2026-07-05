import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/api/envelope";
import {
  detectLogoBackground,
  dominantColorHex,
  LOGO_VARIANT_PLAN,
  processLogo,
  uploadAssetsForUser,
  wordmarkFrom,
  type AssetFileInput,
} from "./assets";

function png(colorType: number, extra: number[] = []): Uint8Array {
  const arr = new Uint8Array(40 + extra.length);
  arr.set([0x89, 0x50, 0x4e, 0x47], 0); // PNG signature
  arr[25] = colorType;
  arr.set(extra, 30);
  return arr;
}

// ---- pure core ------------------------------------------------------------

describe("detectLogoBackground (§6.8)", () => {
  it("treats SVG as transparent", () => {
    expect(detectLogoBackground("logo.svg", new Uint8Array())).toBe("transparent");
  });
  it("treats JPG as solid", () => {
    expect(detectLogoBackground("logo.jpg", new Uint8Array())).toBe("solid");
  });
  it("reads an RGBA PNG (colour type 6) as transparent", () => {
    expect(detectLogoBackground("logo.png", png(6))).toBe("transparent");
  });
  it("reads an opaque RGB PNG (colour type 2) as solid", () => {
    expect(detectLogoBackground("logo.png", png(2))).toBe("solid");
  });
  it("detects a tRNS chunk on a palette PNG as transparent", () => {
    expect(detectLogoBackground("logo.png", png(3, [0x74, 0x52, 0x4e, 0x53]))).toBe("transparent");
  });
});

describe("dominantColorHex", () => {
  it("normalises the first valid extracted brand colour to upper-case #RRGGBB", () => {
    expect(dominantColorHex(["1f6f52", "abc"])).toBe("#1F6F52");
    expect(dominantColorHex(["#2b3a4d"])).toBe("#2B3A4D");
  });
  it("returns null when no usable colour was extracted (caller uses default)", () => {
    expect(dominantColorHex(null)).toBeNull();
    expect(dominantColorHex(["not-a-color"])).toBeNull();
  });
});

describe("wordmarkFrom (§6.8 fallback)", () => {
  it("builds a wordmark from a firm name", () => {
    expect(wordmarkFrom("Meridian Wealth")).toEqual({ text: "Meridian Wealth" });
  });
  it("returns null for an empty name (skip, never blank/AI-generated)", () => {
    expect(wordmarkFrom("   ")).toBeNull();
    expect(wordmarkFrom(null)).toBeNull();
  });
});

describe("processLogo", () => {
  it("bundles format + background + accent + the three-variant plan", () => {
    const p = processLogo("logo.png", png(6), ["1f6f52"]);
    expect(p).toEqual({
      format: "png",
      background: "transparent",
      dominantColor: "#1F6F52",
      variantPlan: LOGO_VARIANT_PLAN,
    });
    expect(LOGO_VARIANT_PLAN.map((v) => v.role)).toEqual(["favicon", "header", "social"]);
  });
});

// ---- IO -------------------------------------------------------------------

function makeDeps(opts: { brandColors?: string[] } = {}) {
  const inserts: { assets: Record<string, unknown>[]; team: Record<string, unknown>[] } = { assets: [], team: [] };
  const uploads: string[] = [];
  let assetSeq = 0;

  const rls = {
    from(table: string) {
      if (table === "accounts") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "acc-1" }, error: null }) }) }) };
      }
      if (table === "orders") {
        return { select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [{ id: "ord-1" }], error: null }) }) }) }) };
      }
      if (table === "intake_data") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: opts.brandColors ? { structured_intake_json: { brandColors: { value: opts.brandColors } } } : null,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "team_members") {
        return {
          select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
          insert: (payload: Record<string, unknown>) => {
            inserts.team.push(payload);
            return { select: () => ({ single: async () => ({ data: { id: `tm-${inserts.team.length}` }, error: null }) }) };
          },
        };
      }
      if (table === "assets") {
        return {
          insert: (payload: Record<string, unknown>) => {
            inserts.assets.push(payload);
            return { select: () => ({ single: async () => ({ data: { id: `asset-${++assetSeq}` }, error: null }) }) };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  const admin = {
    storage: {
      from: () => ({
        upload: async (path: string) => {
          uploads.push(path);
          return { data: { path }, error: null };
        },
      }),
    },
  };
  return { deps: { rls: rls as never, admin: admin as never, userId: "u1" }, inserts, uploads };
}

const logoFile: AssetFileInput = { filename: "logo.png", bytes: png(6), kind: "logo" };

describe("uploadAssetsForUser (§4.1.11)", () => {
  it("rejects the batch when a file is empty", async () => {
    const { deps } = makeDeps();
    await expect(
      uploadAssetsForUser(deps, [{ filename: "logo.png", bytes: new Uint8Array(), kind: "logo" }]),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("rejects an unsupported logo format", async () => {
    const { deps } = makeDeps();
    await expect(
      uploadAssetsForUser(deps, [{ filename: "logo.gif", bytes: png(6), kind: "logo" }]),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("stores the file, creates a typed assets row, and returns logo processing", async () => {
    const { deps, inserts, uploads } = makeDeps({ brandColors: ["1f6f52"] });
    const { assets } = await uploadAssetsForUser(deps, [logoFile]);
    expect(uploads).toHaveLength(1);
    expect(inserts.assets[0]).toMatchObject({ account_id: "acc-1", type: "logo" });
    expect(assets[0].logo?.dominantColor).toBe("#1F6F52");
    expect(assets[0].logo?.background).toBe("transparent");
  });

  it("creates a team_members row for a team photo, linked to the asset", async () => {
    const { deps, inserts } = makeDeps();
    const { assets } = await uploadAssetsForUser(deps, [
      { filename: "jane.jpg", bytes: new Uint8Array([1, 2, 3]), kind: "team_photo", teamMember: { name: "Jane Doe", title: "CFP" } },
    ]);
    expect(inserts.team).toHaveLength(1);
    expect(inserts.team[0]).toMatchObject({ account_id: "acc-1", name: "Jane Doe", title: "CFP", photo_asset_id: "asset-1" });
    expect(assets[0].teamMemberId).toBe("tm-1");
  });
});
