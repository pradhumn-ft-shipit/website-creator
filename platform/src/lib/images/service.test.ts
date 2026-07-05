import { describe, expect, it } from "vitest";

import {
  SITE_ASSETS_BUCKET,
  advisorSlotsFromAssets,
  buildAssetStoragePath,
  extForMime,
} from "./service";

describe("SITE_ASSETS_BUCKET", () => {
  it("is a public bucket name for generated-site imagery", () => {
    expect(SITE_ASSETS_BUCKET).toBe("site-assets");
  });
});

describe("advisorSlotsFromAssets — map advisor uploads to slots", () => {
  it("maps assets whose metadata names a slot", () => {
    const map = advisorSlotsFromAssets([
      { id: "a1", metadata_json: { slot: "hero_background" } },
      { id: "a2", metadata_json: { slot: "about_accent" } },
    ]);
    expect(map.get("hero_background")).toBe("a1");
    expect(map.get("about_accent")).toBe("a2");
  });

  it("ignores assets without a slot hint (logo/team photos aren't slots)", () => {
    const map = advisorSlotsFromAssets([
      { id: "a1", metadata_json: null },
      { id: "a2", metadata_json: { something: "else" } },
    ]);
    expect(map.size).toBe(0);
  });

  it("first asset wins when two claim the same slot", () => {
    const map = advisorSlotsFromAssets([
      { id: "a1", metadata_json: { slot: "hero_background" } },
      { id: "a2", metadata_json: { slot: "hero_background" } },
    ]);
    expect(map.get("hero_background")).toBe("a1");
  });
});

describe("buildAssetStoragePath / extForMime", () => {
  it("derives a stable, order-scoped, unique path with the right extension", () => {
    const path = buildAssetStoragePath("order-1", "hero_background", "image/png", "uuid9");
    expect(path).toBe("sites/order-1/hero_background-uuid9.png");
  });

  it("maps common mime types to extensions and defaults to jpg", () => {
    expect(extForMime("image/png")).toBe("png");
    expect(extForMime("image/jpeg")).toBe("jpg");
    expect(extForMime("image/webp")).toBe("webp");
    expect(extForMime("application/octet-stream")).toBe("jpg");
  });
});
