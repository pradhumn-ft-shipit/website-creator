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
}: RunPipelineArgs): Promise<void> {
  const advance = (stage: PipelineStage, to: OrderState) =>
    step.run(
      stage,
      async () => {
        try {
          // STUB: downstream tickets (010–021) do the real work here.
          return await transitionOrder(client, orderId, to);
        } catch (err) {
          return handleStepFailure(client, orderId, stage, err);
        }
      },
      { retries: STEP_RETRY_POLICY[stage] },
    );

  // payment_received → scraping (scrape stub)
  await advance("scrape", "scraping");
  // scraping → scrape_complete (stub assumes success; real step branches to
  // scrape_failed → docs_upload_fallback on exhaustion — see §13.2)
  await advance("scrape", "scrape_complete");

  // intake: scrape_complete → onboarding_in_progress → onboarding_complete
  await advance("intake", "onboarding_in_progress");
  await advance("intake", "onboarding_complete");

  // iapd is a data-fetch enrichment; no dedicated state, modeled as a no-op step
  await step.run(
    "iapd",
    async () => {
      try {
        return { ok: true };
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
  const needsLayer3 = layer3Required({ verdict: "pass", siteIndex: 0 });
  if (needsLayer3) {
    await advance("layer3", "compliance_review_layer3");
    await advance("layer3", "building");
  } else {
    await advance("validation", "building");
  }

  // images: best-effort enrichment, non-blocking (no dedicated state)
  await step.run(
    "images",
    async () => {
      try {
        return { ok: true };
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
