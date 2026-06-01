import { describe, it, expect, vi } from "vitest";

import { RateLimitError } from "./errors";
import {
  STEP_RETRY_POLICY,
  PIPELINE_STAGES,
  runPipeline,
  handleStepFailure,
} from "./pipeline";

/** Mocked admin client recording transitions + alerts. */
function makeClient(startStatus = "payment_received") {
  let status = startStatus;
  const transitions: string[] = [];
  const alerts: Array<Record<string, unknown>> = [];

  const client = {
    from(table: string) {
      if (table === "orders") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { status }, error: null }),
            }),
          }),
          update: (payload: { status: string }) => {
            status = payload.status;
            transitions.push(payload.status);
            return { eq: async () => ({ data: null, error: null }) };
          },
        };
      }
      return {
        insert: async (payload: Record<string, unknown>) => {
          alerts.push(payload);
          return { data: null, error: null };
        },
      };
    },
  };

  return { client, transitions, alerts, getStatus: () => status };
}

/** Mocked Inngest step: runs the fn inline, ignoring opts. */
function makeStep() {
  return {
    run: vi.fn(async (_id: string, fn: () => unknown) => fn()),
  };
}

describe("retry policy table (§13.2)", () => {
  it("matches the PRD per-step retry budgets", () => {
    expect(STEP_RETRY_POLICY.scrape).toBe(2);
    expect(STEP_RETRY_POLICY.iapd).toBe(2);
    expect(STEP_RETRY_POLICY.generation).toBe(1);
    expect(STEP_RETRY_POLICY.validation).toBe(1);
    expect(STEP_RETRY_POLICY.images).toBe(2);
    expect(STEP_RETRY_POLICY["repo.create"]).toBe(3);
    expect(STEP_RETRY_POLICY.build).toBe(1);
    expect(STEP_RETRY_POLICY["repo.push"]).toBe(3);
    expect(STEP_RETRY_POLICY["vercel.create"]).toBe(3);
    expect(STEP_RETRY_POLICY.deploy).toBe(3);
    expect(STEP_RETRY_POLICY.verify).toBe(2);
    expect(STEP_RETRY_POLICY.email).toBe(2);
    expect(STEP_RETRY_POLICY.intake).toBe(0);
    expect(STEP_RETRY_POLICY.layer3).toBe(0);
  });

  it("declares a stage stub per PRD §9.2 pipeline stage", () => {
    expect(PIPELINE_STAGES).toEqual([
      "scrape",
      "intake",
      "iapd",
      "generation",
      "validation",
      "layer3",
      "images",
      "repo.create",
      "build",
      "repo.push",
      "vercel.create",
      "deploy",
      "verify",
      "email",
      "dns.monitor",
    ]);
  });
});

describe("runPipeline (happy path through stubs)", () => {
  it("advances the order from payment_received to dns_monitoring", async () => {
    const { client, getStatus } = makeClient();
    const step = makeStep();

    await runPipeline({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      step: step as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: client as any,
      orderId: "order-1",
      accountId: "acct-1",
    });

    expect(getStatus()).toBe("dns_monitoring");
    // every stub ran via step.run
    expect(step.run).toHaveBeenCalled();
  });
});

describe("handleStepFailure (escalation)", () => {
  it("writes an order_failed admin alert and rethrows on non-rate-limit error", async () => {
    const { client, alerts } = makeClient("building");
    const err = new Error("build exploded");

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handleStepFailure(client as any, "order-1", "build", err),
    ).rejects.toThrow("build exploded");

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ type: "order_failed" });
  });

  it("on a rate-limit error logs to rate-limits.md and rethrows (so Inngest retries) without escalating", async () => {
    const { client, alerts } = makeClient("scraping");
    const err = new RateLimitError("429 from firecrawl", {
      service: "firecrawl",
      endpoint: "scrape",
    });
    const log = vi.fn(async () => undefined);

    await expect(
      handleStepFailure(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client as any,
        "order-1",
        "scrape",
        err,
        log,
      ),
    ).rejects.toBe(err);

    // rate-limit path logs, does NOT escalate (Inngest will back off + retry)
    expect(log).toHaveBeenCalledTimes(1);
    expect(alerts).toHaveLength(0);
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ service: "firecrawl" }),
    );
  });
});
