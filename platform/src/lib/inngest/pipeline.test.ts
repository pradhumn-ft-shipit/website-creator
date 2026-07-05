import { describe, it, expect, vi } from "vitest";

import { RateLimitError } from "./errors";
import {
  STEP_RETRY_POLICY,
  PIPELINE_STAGES,
  runPipeline,
  handleStepFailure,
} from "./pipeline";

/** Mocked admin client recording transitions, alerts, and state events. */
function makeClient(startStatus = "payment_received") {
  let status = startStatus;
  const transitions: string[] = [];
  const alerts: Array<Record<string, unknown>> = [];
  const events: Array<Record<string, unknown>> = [];

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
      if (table === "order_state_events") {
        return {
          insert: async (payload: Record<string, unknown>) => {
            events.push(payload);
            return { data: null, error: null };
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

  return { client, transitions, alerts, events, getStatus: () => status };
}

/** Default injected step bodies: a sufficient scrape + a no-op intake/iapd. */
const proceedScrape = async () => ({ route: "proceed" as const, result: {} as never });
const noopIntake = async () => ({});
const skippedIapd = async () => ({ route: "skipped" as const, reason: "no_crd" as const });
const noopImages = async () => ({ images: [] });
const noopLegal = async () => ({ pages: [] });

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
  it("advances the order from payment_received to dns_monitoring (scrape proceeds)", async () => {
    const { client, getStatus, transitions } = makeClient();
    const step = makeStep();

    await runPipeline({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      step: step as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: client as any,
      orderId: "order-1",
      accountId: "acct-1",
      scrape: proceedScrape,
      intake: noopIntake,
      iapd: skippedIapd,
      images: noopImages,
      legal: noopLegal,
    });

    expect(getStatus()).toBe("dns_monitoring");
    // The proceed route goes through scrape_complete, never the failure branch.
    expect(transitions).toContain("scrape_complete");
    expect(transitions).not.toContain("scrape_failed");
    expect(step.run).toHaveBeenCalled();
  });

  it("routes an insufficient scrape into the docs-upload fallback (§4.3)", async () => {
    const { client, getStatus, transitions, events } = makeClient();
    const step = makeStep();
    const scrape = async () => ({ route: "docs_fallback" as const, reason: "single_page" as const });
    const intake = vi.fn(noopIntake);

    await runPipeline({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      step: step as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: client as any,
      orderId: "order-1",
      accountId: "acct-1",
      scrape,
      intake,
      iapd: skippedIapd,
      images: noopImages,
      legal: noopLegal,
    });

    // Failure branch taken, then converges and still reaches the end.
    expect(transitions).toContain("scrape_failed");
    expect(transitions).toContain("docs_upload_fallback");
    expect(transitions).not.toContain("scrape_complete");
    expect(getStatus()).toBe("dns_monitoring");
    // The soft-failure reason is recorded as a state-event note (§4.3 analytics).
    const failEvent = events.find((e) => e.to_status === "scrape_failed");
    expect(failEvent?.note).toContain("single_page");
    // intake.process still runs on the fallback route.
    expect(intake).toHaveBeenCalledTimes(1);
  });

  it("still runs intake.process on the proceed route", async () => {
    const { client } = makeClient();
    const step = makeStep();
    const intake = vi.fn(noopIntake);
    await runPipeline({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      step: step as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: client as any,
      orderId: "order-1",
      accountId: "acct-1",
      scrape: proceedScrape,
      intake,
      iapd: skippedIapd,
      images: noopImages,
      legal: noopLegal,
    });
    expect(intake).toHaveBeenCalledTimes(1);
  });

  it("runs the injected iapd step and does not fail the order on an upload_prompt outcome", async () => {
    const { client, getStatus } = makeClient();
    const step = makeStep();
    const iapd = vi.fn(async () => ({
      route: "upload_prompt" as const,
      reason: "iapd_and_scrape_unavailable" as const,
    }));

    await runPipeline({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      step: step as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: client as any,
      orderId: "order-1",
      accountId: "acct-1",
      scrape: proceedScrape,
      intake: noopIntake,
      iapd,
      images: noopImages,
      legal: noopLegal,
    });

    expect(iapd).toHaveBeenCalledTimes(1);
    expect(iapd).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "order-1", accountId: "acct-1" }),
    );
    // A missing IAPD document is a soft outcome — the order still completes.
    expect(getStatus()).toBe("dns_monitoring");
  });

  it("escalates to admin_alerts and halts when the iapd step throws (rate limit propagated)", async () => {
    const { client, alerts } = makeClient();
    const step = makeStep();
    const iapd = async () => {
      throw new Error("iapd exploded");
    };

    await expect(
      runPipeline({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        step: step as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client: client as any,
        orderId: "order-1",
        accountId: "acct-1",
        scrape: proceedScrape,
        intake: noopIntake,
        iapd,
        images: noopImages,
        legal: noopLegal,
      }),
    ).rejects.toThrow("iapd exploded");
    expect(alerts).toHaveLength(1);
  });

  it("runs the images.generate + legal.generate steps with the order + account (022)", async () => {
    const { client } = makeClient();
    const step = makeStep();
    const images = vi.fn(noopImages);
    const legal = vi.fn(noopLegal);

    await runPipeline({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      step: step as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: client as any,
      orderId: "order-1",
      accountId: "acct-1",
      scrape: proceedScrape,
      intake: noopIntake,
      iapd: skippedIapd,
      images,
      legal,
    });

    expect(images).toHaveBeenCalledTimes(1);
    expect(legal).toHaveBeenCalledTimes(1);
    expect(images).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "order-1", accountId: "acct-1" }),
    );
    expect(legal).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "order-1", accountId: "acct-1" }),
    );
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
