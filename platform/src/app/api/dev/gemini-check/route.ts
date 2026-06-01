/**
 * Dev-gated Gemini smoke check. Generates a tiny structured object and returns
 * token usage + estimated cost via the `{data,error}` envelope — proof the
 * client, routing, schema enforcement, and cost accounting are wired correctly.
 *
 * Hard-disabled outside development (returns 404 via AppError) so it can never
 * run up cost or leak in production. Requires `GEMINI_API_KEY` (the §9.3 dev
 * key, low quotas); without it the client throws and you get a clean envelope.
 *
 *   GET /api/dev/gemini-check
 */

import { apiHandler, AppError } from "@/lib/api/envelope";
import {
  CostAccumulator,
  geminiClient,
  type OutputSchema,
} from "@/lib/gemini";

interface Ping {
  greeting: string;
  ok: boolean;
}

// A tiny hand-written schema — same `OutputSchema<T>` contract callers use.
const pingSchema: OutputSchema<Ping> = {
  jsonSchema: {
    type: "object",
    properties: { greeting: { type: "string" }, ok: { type: "boolean" } },
    required: ["greeting", "ok"],
  },
  parse(value: unknown): Ping {
    const v = value as Partial<Ping>;
    if (typeof v?.greeting !== "string" || typeof v?.ok !== "boolean") {
      throw new Error("expected { greeting: string, ok: boolean }");
    }
    return { greeting: v.greeting, ok: v.ok };
  },
};

export const GET = apiHandler(async () => {
  if (process.env.NODE_ENV === "production") {
    // Not found in prod — never expose the cost-incurring check.
    throw new AppError("Not found.", "not_found", 404);
  }

  const costAccumulator = new CostAccumulator();
  const client = geminiClient({ costAccumulator });

  const result = await client.generateJSON({
    useCase: "validation", // cheapest model (Flash) for a smoke test
    operation: "post_launch_edit", // smallest budget
    schema: pingSchema,
    systemInstruction:
      "You are a health check. Reply with the smallest valid JSON object.",
    prompt:
      'Return JSON: {"greeting":"hello from gemini","ok":true}. Nothing else.',
  });

  return {
    model: result.model,
    output: result.data,
    usage: result.usage,
    costUsd: Number(result.costUsd.toFixed(6)),
    site: costAccumulator.snapshot(),
  };
});
