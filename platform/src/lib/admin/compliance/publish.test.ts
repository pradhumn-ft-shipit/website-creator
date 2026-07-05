import { describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/api/envelope";
import {
  assertTwoPersonApproval,
  buildPublishedManifest,
  checkTwoPersonApproval,
  computePublishReadiness,
  publishDraft,
  type ArtifactWriter,
  type DraftReview,
  type PublishableDraft,
} from "./publish";

const review = (over: Partial<DraftReview> = {}): DraftReview => ({
  reviewerId: "alice",
  reviewerEmail: "alice@wri.com",
  role: "drafter",
  decision: "signed_off",
  at: "2026-07-05T10:00:00Z",
  ...over,
});

const MINIMAL_RULES = {
  industry: "ria",
  version: "1.1",
  status: "draft",
  prohibited_terms: [],
  prohibited_content: [],
  required_elements: [],
  required_disclosures: [],
  conditional_rules: [],
  citations: {},
};

// ---- the two-person gate (the guardrail) ---------------------------------

describe("checkTwoPersonApproval / assertTwoPersonApproval", () => {
  it("rejects with zero sign-offs", () => {
    expect(checkTwoPersonApproval([]).ok).toBe(false);
    expect(() => assertTwoPersonApproval([])).toThrow(AppError);
  });

  it("rejects a single approver (only one person)", () => {
    const reviews = [review({ reviewerId: "bob", reviewerEmail: "bob@wri.com", role: "approver" })];
    const check = checkTwoPersonApproval(reviews);
    expect(check.ok).toBe(false);
    expect(check.reasons.join(" ")).toContain("drafter");
    expect(() => assertTwoPersonApproval(reviews)).toThrow(/Two-person review required/);
  });

  it("rejects when the same person signs both drafter AND approver", () => {
    const reviews = [
      review({ reviewerId: "alice", role: "drafter" }),
      review({ reviewerId: "alice", role: "approver" }),
    ];
    const check = checkTwoPersonApproval(reviews);
    expect(check.ok).toBe(false);
    expect(check.reasons.join(" ")).toMatch(/different people/);
    expect(() => assertTwoPersonApproval(reviews)).toThrow(AppError);
  });

  it("passes with a distinct drafter + approver (two different people)", () => {
    const reviews = [
      review({ reviewerId: "alice", reviewerEmail: "alice@wri.com", role: "drafter" }),
      review({ reviewerId: "bob", reviewerEmail: "bob@wri.com", role: "approver" }),
    ];
    const check = checkTwoPersonApproval(reviews);
    expect(check.ok).toBe(true);
    expect(check.signers.sort()).toEqual(["alice", "bob"]);
    expect(() => assertTwoPersonApproval(reviews)).not.toThrow();
  });

  it("ignores changes_requested reviews", () => {
    const reviews = [
      review({ reviewerId: "alice", role: "drafter" }),
      review({ reviewerId: "bob", role: "approver", decision: "changes_requested" }),
    ];
    expect(checkTwoPersonApproval(reviews).ok).toBe(false);
  });
});

// ---- readiness -----------------------------------------------------------

function draft(over: Partial<PublishableDraft> = {}): PublishableDraft {
  return {
    id: "draft-1",
    industry: "ria",
    subIndustry: null,
    baseVersion: "1.0",
    targetVersion: "1.1",
    rulesJson: MINIMAL_RULES,
    rulesMarkdown: "# RIA v1.1",
    manifestJson: { artifacts: { rules_machine: "rules.json" } },
    reviews: [
      review({ reviewerId: "alice", role: "drafter" }),
      review({ reviewerId: "bob", reviewerEmail: "bob@wri.com", role: "approver" }),
    ],
    status: "in_review",
    ...over,
  };
}

describe("computePublishReadiness", () => {
  it("is ready when gate + content are satisfied", () => {
    expect(computePublishReadiness(draft()).ready).toBe(true);
  });

  it("is not ready without the two-person gate", () => {
    const r = computePublishReadiness(draft({ reviews: [review()] }));
    expect(r.ready).toBe(false);
  });

  it("is not ready with invalid rules.json", () => {
    const r = computePublishReadiness(draft({ rulesJson: { nope: true } }));
    expect(r.ready).toBe(false);
    expect(r.reasons.some((x) => x.includes("rules.json"))).toBe(true);
  });

  it("is not ready once already published", () => {
    expect(computePublishReadiness(draft({ status: "published" })).ready).toBe(false);
  });
});

describe("buildPublishedManifest", () => {
  it("stamps approval, distinct reviewers, and publish metadata", () => {
    const manifest = buildPublishedManifest(draft(), "carol@wri.com", "2026-07-05T12:00:00Z");
    expect(manifest.version).toBe("1.1");
    expect(manifest.review).toMatchObject({ approved: true, two_person_required: true });
    expect((manifest.review as { reviewers: string[] }).reviewers.sort()).toEqual([
      "alice@wri.com",
      "bob@wri.com",
    ]);
    expect(manifest.published_by).toBe("carol@wri.com");
    expect(manifest.published_at).toBe("2026-07-05T12:00:00Z");
  });
});

// ---- publishDraft (IO with injected boundaries) --------------------------

function makeWriter() {
  const writes: Record<string, string> = {};
  const copies: Array<[string, string]> = [];
  const dirs: string[] = [];
  const writer: ArtifactWriter = {
    exists: () => false,
    ensureDir: (p) => dirs.push(p),
    writeFile: (p, c) => {
      writes[p] = c;
    },
    copyDir: (s, d) => copies.push([s, d]),
  };
  return { writer, writes, copies, dirs };
}

/** Minimal supabase mock: draft select, ruleset insert, draft update. */
function makeClient(draftRow: Record<string, unknown>) {
  const recorded: { insert?: unknown; update?: unknown } = {};
  function builder(result: { data: unknown; error: unknown }) {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is"]) b[m] = () => b;
    const single = async () => ({ data: result.data, error: result.error });
    b.maybeSingle = single;
    b.single = single;
    b.then = (resolve: (v: unknown) => unknown) => resolve(result);
    return b;
  }
  const client = {
    from(table: string) {
      if (table === "compliance_ruleset_drafts") {
        return {
          select: () => builder({ data: draftRow, error: null }),
          update: (row: unknown) => {
            recorded.update = row;
            return builder({ data: null, error: null });
          },
        };
      }
      // compliance_rulesets
      return {
        insert: (row: unknown) => {
          recorded.insert = row;
          return builder({ data: { id: "ruleset-99" }, error: null });
        },
      };
    },
  };
  return { client, recorded };
}

describe("publishDraft", () => {
  const draftRow = {
    id: "draft-1",
    industry: "ria",
    sub_industry: null,
    base_version: "1.0",
    target_version: "1.1",
    rules_json: MINIMAL_RULES,
    rules_markdown: "# RIA v1.1",
    manifest_json: { artifacts: { rules_machine: "rules.json" } },
    reviews_json: [
      review({ reviewerId: "alice", reviewerEmail: "alice@wri.com", role: "drafter" }),
      review({ reviewerId: "bob", reviewerEmail: "bob@wri.com", role: "approver" }),
    ],
    status: "in_review",
  };

  it("writes artifacts, inserts the ruleset row, and queues re-validation", async () => {
    const { client, recorded } = makeClient(draftRow);
    const { writer, writes, copies } = makeWriter();
    const send = vi.fn().mockResolvedValue(undefined);

    const result = await publishDraft(
      { client: client as never, writer, lint: () => ({ ok: true, errors: [] }), send, complianceRoot: "/repo/compliance", now: () => new Date("2026-07-05T12:00:00Z") },
      { draftId: "draft-1", publisherId: null, publisherEmail: "carol@wri.com" },
    );

    expect(result.versionString).toBe("ria/v1.1");
    expect(result.rulesetId).toBe("ruleset-99");
    expect(result.revalidationQueued).toBe(true);
    // Wrote the three artifacts + carried disclosures from the base version.
    expect(Object.keys(writes).some((p) => p.endsWith("v1.1/rules.json"))).toBe(true);
    expect(Object.keys(writes).some((p) => p.endsWith("v1.1/manifest.json"))).toBe(true);
    expect(copies[0][0]).toContain("v1.0/disclosures");
    // Mirrored into compliance_rulesets with publish metadata.
    expect(recorded.insert).toMatchObject({ industry: "ria", version: "1.1", published_by: null });
    // Queued re-validation for the new version.
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ name: "compliance.revalidate", data: expect.objectContaining({ versionString: "ria/v1.1" }) }),
    );
  });

  it("refuses to publish when the two-person gate is not met (no writes, no send)", async () => {
    const oneSigner = { ...draftRow, reviews_json: [review({ role: "drafter" })] };
    const { client } = makeClient(oneSigner);
    const { writer, writes } = makeWriter();
    const send = vi.fn();

    await expect(
      publishDraft(
        { client: client as never, writer, lint: () => ({ ok: true, errors: [] }), send, complianceRoot: "/repo/compliance" },
        { draftId: "draft-1", publisherId: null, publisherEmail: "carol@wri.com" },
      ),
    ).rejects.toMatchObject({ code: "two_person_required" });
    expect(Object.keys(writes)).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("refuses to publish when lint:rulesets fails (compliance guardrail)", async () => {
    const { client } = makeClient(draftRow);
    const { writer } = makeWriter();
    const send = vi.fn();

    await expect(
      publishDraft(
        { client: client as never, writer, lint: () => ({ ok: false, errors: ["rules.json: bad"] }), send, complianceRoot: "/repo/compliance" },
        { draftId: "draft-1", publisherId: null, publisherEmail: "carol@wri.com" },
      ),
    ).rejects.toMatchObject({ code: "ruleset_invalid" });
    expect(send).not.toHaveBeenCalled();
  });
});
