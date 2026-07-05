/**
 * Generation pipeline (PRD §9.2, §13.1, §13.2, §18.1).
 *
 * A single Inngest function triggered by `order.created`. Each PRD pipeline
 * stage is a `step.run` STUB that advances the order through its state machine;
 * downstream tickets (010–021) replace each stub body with real work. Per-step
 * retry policies come straight from §13.2. Failures beyond auto-retry escalate
 * to `admin_alerts`; rate-limit errors are logged + re-thrown so Inngest backs
 * off and retries.
 *
 * Orchestration is split into a pure-ish, testable `runPipeline` (takes a step
 * + client) and the Inngest function wrapper, mirroring the IO/core split used
 * elsewhere in the repo.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  type OrderState,
  layer3Required,
} from "@/lib/orders/state-machine";
import { transitionOrder, escalateOrderFailure } from "@/lib/orders/transitions";
import { runScrape, processIntake, type ScrapeOutcome } from "@/lib/intake";
import { fetchIapdDocuments, type IapdFetchOutcome } from "@/lib/iapd";
import { runImagesStep } from "@/lib/images";
import { generateLegalPages } from "@/lib/legal-pages";

import { inngest } from "./client";
import { isRateLimitError } from "./errors";
import { appendRateLimitLog, type RateLimitEntry } from "./rate-limit-log";

type AdminClient = SupabaseClient<Database>;

/** Pipeline stages in order (PRD §9.2). */
export const PIPELINE_STAGES = [
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
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/** Per-step retry budget (Inngest `retries`), from §13.2. */
export const STEP_RETRY_POLICY: Record<PipelineStage, number> = {
  scrape: 2,
  intake: 0,
  iapd: 2,
  generation: 1,
  validation: 1,
  layer3: 0,
  images: 2,
  "repo.create": 3,
  build: 1,
  "repo.push": 3,
  "vercel.create": 3,
  deploy: 3,
  verify: 2,
  email: 2,
  "dns.monitor": 0,
};

/**
 * Failure handler shared by every step. On a rate-limit error: log to
 * state/rate-limits.md and rethrow so Inngest backs off + retries (no admin
 * escalation — it's transient). On any other terminal error: escalate to
 * admin_alerts, then rethrow so Inngest marks the run failed.
 */
export async function handleStepFailure(
  client: AdminClient,
  orderId: string,
  stage: PipelineStage,
  err: unknown,
  logRateLimit: (e: RateLimitEntry) => Promise<void> = appendRateLimitLog,
): Promise<never> {
  if (isRateLimitError(err)) {
    await logRateLimit({
      service: err.service ?? "unknown",
      endpoint: err.endpoint ?? stage,
      timestamp: new Date().toISOString(),
      code: "rate_limited",
      fallback: "Inngest backoff + retry",
    });
    throw err;
  }

  await escalateOrderFailure(client, orderId, err, stage);
  throw err;
}

/**
 * Minimal structural type for the one Inngest capability the pipeline uses:
 * `step.run(id, fn, opts?)`. Typed loosely (returns `Promise<unknown>`) so it
 * accepts BOTH the real Inngest `step` (whose return is JSON-transformed) and a
 * plain inline mock in tests. We never depend on the stub return values, so the
 * looseness costs nothing.
 */
export interface PipelineStep {
  run(
    id: string,
    fn: () => unknown,
    opts?: { retries?: number },
  ): Promise<unknown>;
}

interface RunPipelineArgs {
  step: PipelineStep;
  client: AdminClient;
  orderId: string;
  accountId: string;
  /**
   * The real scrape/intake step bodies (012), injectable so tests drive the
   * pipeline without a live Firecrawl / Gemini / Storage. Default to the real
   * implementations; the Inngest wrapper relies on the defaults.
   */
  scrape?: (deps: { client: AdminClient; orderId: string }) => Promise<ScrapeOutcome>;
  intake?: (deps: { client: AdminClient; orderId: string }) => Promise<unknown>;
  /** The real iapd.fetch step body (014), injectable so tests don't hit a live
   * SEC IAPD endpoint. Defaults to the real implementation. */
  iapd?: (deps: {
    client: AdminClient;
    orderId: string;
    accountId: string;
  }) => Promise<IapdFetchOutcome>;
  /**
   * Real 022 step bodies (images + legal/hygiene pages), injectable so tests
   * drive the pipeline without live stock/Gemini/Supabase. Default to the real
   * implementations; the Inngest wrapper relies on the defaults.
   */
  images?: (deps: {
    client: AdminClient;
    orderId: string;
    accountId: string;
  }) => Promise<unknown>;
  legal?: (deps: {
    client: AdminClient;
    orderId: string;
    accountId: string;
  }) => Promise<unknown>;
}

/**
 * Drive the order through the full state machine via step stubs. Each stub is a
 * no-op that advances state; downstream tickets fill in the real work. Errors
 * are routed through `handleStepFailure` for escalation / rate-limit logging.
 */
export async function runPipeline({
  step,
  client,
  orderId,
  accountId,
  scrape = runScrape,
  intake = processIntake,
  iapd = (deps) => fetchIapdDocuments(deps),
  images = runImagesStep,
  legal = generateLegalPages,
}: RunPipelineArgs): Promise<void> {
  // Step ids are `${stage}:${to}` so every transition is a DISTINCT Inngest step
  // — same-id steps are memoised and would silently skip re-execution, which is
  // why a stage advancing through several states needs a unique id per state.
  const advance = (stage: PipelineStage, to: OrderState, note?: string) =>
    step.run(
      `${stage}:${to}`,
      async () => {
        try {
          return await transitionOrder(client, orderId, to, note);
        } catch (err) {
          return handleStepFailure(client, orderId, stage, err);
        }
      },
      { retries: STEP_RETRY_POLICY[stage] },
    );

  // payment_received → scraping
  await advance("scrape", "scraping");

  // scrape.run (012): crawl + sufficiency. Returns the route; a slim result keeps
  // the step output small (we don't carry the full crawl through memoisation).
  const outcome = (await step.run(
    "scrape.run",
    async () => {
      try {
        const result = await scrape({ client, orderId });
        return result.route === "proceed"
          ? { route: "proceed" as const }
          : { route: "docs_fallback" as const, reason: result.reason };
      } catch (err) {
        return handleStepFailure(client, orderId, "scrape", err);
      }
    },
    { retries: STEP_RETRY_POLICY.scrape },
  )) as { route: "proceed" } | { route: "docs_fallback"; reason: string };

  if (outcome.route === "proceed") {
    await advance("scrape", "scrape_complete");
  } else {
    // §4.2 (no site) / §4.3 (insufficient/blocked): recover into the docs-upload
    // branch. The reason is recorded on the transition as the soft-failure event
    // (§4.3, internal analytics) via order_state_events.
    await advance("scrape", "scrape_failed", `docs-upload fallback: ${outcome.reason}`);
    await advance("scrape", "docs_upload_fallback");
  }

  // intake.process (012): extract Round-1 fields from scrape + uploads into
  // structured_intake_json. Runs on both routes; does not transition state.
  await step.run(
    "intake.process",
    async () => {
      try {
        return await intake({ client, orderId });
      } catch (err) {
        return handleStepFailure(client, orderId, "intake", err);
      }
    },
    { retries: STEP_RETRY_POLICY.intake },
  );

  // Both routes converge: → onboarding_in_progress → onboarding_complete
  await advance("intake", "onboarding_in_progress");
  await advance("intake", "onboarding_complete");

  // iapd.fetch (014, §5.4): pull ADV/CRS by CRD, falling back to the crawl
  // already captured by the scrape step, then to an advisor upload prompt.
  // Best-effort enrichment (no dedicated state) — a hard IAPD/scrape failure
  // does not fail the order; only a rate limit propagates for Inngest backoff.
  await step.run(
    "iapd",
    async () => {
      try {
        return await iapd({ client, orderId, accountId });
      } catch (err) {
        return handleStepFailure(client, orderId, "iapd", err);
      }
    },
    { retries: STEP_RETRY_POLICY.iapd },
  );

  // generation: onboarding_complete → generating_copy → copy_review → copy_approved
  await advance("generation", "generating_copy");
  await advance("generation", "copy_review");
  await advance("generation", "copy_approved");

  // validation (Layer 2): copy_approved → compliance_review_layer2
  await advance("validation", "compliance_review_layer2");

  // Layer-3 gating (Q4c, §5.2/§13.3): only when Layer 2 flags OR within first 50.
  // Stub verdict = "pass", siteIndex = 0 (alpha → first-50 gate fires).
  // TODO(020/006): thread the REAL Layer-2 `verdict` (006) and the order's actual
  // `siteIndex` (020/033) into `layer3Required` — until then every post-50 passing
  // site keeps routing through manual review because siteIndex is pinned to 0.
  const needsLayer3 = layer3Required({ verdict: "pass", siteIndex: 0 });
  if (needsLayer3) {
    await advance("layer3", "compliance_review_layer3");
    await advance("layer3", "building");
  } else {
    await advance("validation", "building");
  }

  // images.generate (022): resolve every image slot — advisor upload → stock →
  // capped AI (abstract/office/nature only, no people, guarded at the call
  // boundary). Stores assets + emits the manifest the build (024) consumes.
  await step.run(
    "images.generate",
    async () => {
      try {
        return await images({ client, orderId, accountId });
      } catch (err) {
        return handleStepFailure(client, orderId, "images", err);
      }
    },
    { retries: STEP_RETRY_POLICY.images },
  );

  // legal.generate (022): Privacy Policy + ToS/Disclaimer + 404, per industry +
  // state, Layer-2-validated, persisted as generated_content for the build (024).
  // Shares the images retry budget; failures escalate under the "images" stage.
  await step.run(
    "legal.generate",
    async () => {
      try {
        return await legal({ client, orderId, accountId });
      } catch (err) {
        return handleStepFailure(client, orderId, "images", err);
      }
    },
    { retries: STEP_RETRY_POLICY.images },
  );

  // repo.create + build + repo.push: building stage work, then → deploying
  await step.run(
    "repo.create",
    async () => {
      try {
        return { ok: true };
      } catch (err) {
        return handleStepFailure(client, orderId, "repo.create", err);
      }
    },
    { retries: STEP_RETRY_POLICY["repo.create"] },
  );
  await step.run(
    "build",
    async () => {
      try {
        return { ok: true };
      } catch (err) {
        return handleStepFailure(client, orderId, "build", err);
      }
    },
    { retries: STEP_RETRY_POLICY.build },
  );
  await step.run(
    "repo.push",
    async () => {
      try {
        return { ok: true };
      } catch (err) {
        return handleStepFailure(client, orderId, "repo.push", err);
      }
    },
    { retries: STEP_RETRY_POLICY["repo.push"] },
  );

  // vercel.create + deploy: building → deploying → deployed
  await advance("deploy", "deploying");
  await step.run(
    "vercel.create",
    async () => {
      try {
        return { ok: true };
      } catch (err) {
        return handleStepFailure(client, orderId, "vercel.create", err);
      }
    },
    { retries: STEP_RETRY_POLICY["vercel.create"] },
  );
  await advance("deploy", "deployed");

  // verify + email: deployed → email_sent → live
  await step.run(
    "verify",
    async () => {
      try {
        return { ok: true };
      } catch (err) {
        return handleStepFailure(client, orderId, "verify", err);
      }
    },
    { retries: STEP_RETRY_POLICY.verify },
  );
  await advance("email", "email_sent");
  await advance("email", "live");

  // dns.monitor: live → dns_monitoring (background poll, non-blocking)
  await advance("dns.monitor", "dns_monitoring");
}

/**
 * The Inngest function. Triggered by `order.created`; delegates to runPipeline
 * with the real service-role client.
 */
export const generationPipeline = inngest.createFunction(
  { id: "generation-pipeline", name: "WRI Generation Pipeline" },
  { event: "order.created" },
  async ({ event, step }) => {
    const client = createAdminClient();
    await runPipeline({
      step,
      client,
      orderId: event.data.orderId,
      accountId: event.data.accountId,
    });
    return { orderId: event.data.orderId, status: "dns_monitoring" };
  },
);
