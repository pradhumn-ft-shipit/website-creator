import { describe, expect, it } from "vitest";

import { addReview, createDraft } from "./drafts";
import type { DraftReview } from "./publish";

/** Supabase mock supporting insert/select/single, select/eq/maybeSingle, update/eq/select/single. */
function makeClient(opts: { existing?: Record<string, unknown> | null; returning: Record<string, unknown> }) {
  const rec: { insert?: unknown; update?: unknown } = {};
  function builder(result: { data: unknown; error: unknown }) {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order"]) b[m] = () => b;
    const single = async () => ({ data: result.data, error: result.error });
    b.maybeSingle = single;
    b.single = single;
    b.then = (resolve: (v: unknown) => unknown) => resolve(result);
    return b;
  }
  const client = {
    from() {
      return {
        insert: (row: unknown) => {
          rec.insert = row;
          return builder({ data: opts.returning, error: null });
        },
        select: () => builder({ data: opts.existing ?? null, error: null }),
        update: (row: unknown) => {
          rec.update = row;
          return builder({ data: opts.returning, error: null });
        },
      };
    },
  };
  return { client, rec };
}

const RETURNING = {
  id: "draft-1",
  industry: "ria",
  sub_industry: null,
  base_version: "1.0",
  target_version: "1.1",
  status: "in_review",
  reviews_json: [],
  research_json: null,
  created_at: "2026-07-05T00:00:00Z",
  updated_at: "2026-07-05T00:00:00Z",
};

const review = (over: Partial<DraftReview> = {}): DraftReview => ({
  reviewerId: "alice",
  reviewerEmail: "alice@wri.com",
  role: "drafter",
  decision: "signed_off",
  at: "2026-07-05T10:00:00Z",
  ...over,
});

describe("createDraft", () => {
  it("inserts a draft and returns the summary", async () => {
    const { client, rec } = makeClient({ returning: RETURNING });
    const summary = await createDraft(client as never, {
      industry: "ria",
      baseVersion: "1.0",
      targetVersion: "1.1",
      rulesMarkdown: "# v1.1",
      createdBy: "user-1",
    });
    expect(summary.id).toBe("draft-1");
    expect(rec.insert).toMatchObject({ industry: "ria", target_version: "1.1", status: "draft" });
  });
});

describe("addReview", () => {
  it("appends a sign-off and moves the draft to in_review", async () => {
    const existing = { reviews_json: [], status: "draft" };
    const { client, rec } = makeClient({ existing, returning: { ...RETURNING, reviews_json: [review()] } });
    await addReview(client as never, "draft-1", review());
    const update = rec.update as { reviews_json: DraftReview[]; status: string };
    expect(update.status).toBe("in_review");
    expect(update.reviews_json).toHaveLength(1);
  });

  it("replaces a prior sign-off by the same reviewer+role (no double count)", async () => {
    const existing = { reviews_json: [review({ note: "old" })], status: "in_review" };
    const { client, rec } = makeClient({ existing, returning: RETURNING });
    await addReview(client as never, "draft-1", review({ note: "new" }));
    const update = rec.update as { reviews_json: DraftReview[] };
    expect(update.reviews_json).toHaveLength(1);
    expect(update.reviews_json[0].note).toBe("new");
  });

  it("keeps a distinct reviewer's sign-off (two-person accumulation)", async () => {
    const existing = { reviews_json: [review({ reviewerId: "alice", role: "drafter" })], status: "in_review" };
    const { client, rec } = makeClient({ existing, returning: RETURNING });
    await addReview(client as never, "draft-1", review({ reviewerId: "bob", reviewerEmail: "bob@wri.com", role: "approver" }));
    const update = rec.update as { reviews_json: DraftReview[] };
    expect(update.reviews_json).toHaveLength(2);
  });

  it("rejects reviewing a published draft", async () => {
    const { client } = makeClient({ existing: { reviews_json: [], status: "published" }, returning: RETURNING });
    await expect(addReview(client as never, "draft-1", review())).rejects.toMatchObject({ code: "already_published" });
  });
});
