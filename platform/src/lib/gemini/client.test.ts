import { describe, expect, it, vi } from "vitest";

import {
  GeminiClient,
  type GenAIBoundary,
  type GenAIResponse,
} from "./client";
import {
  GeminiRateLimitError,
  SchemaValidationError,
  TokenBudgetExceededError,
} from "./errors";
import { GEMINI_MODELS } from "./models";
import { CostAccumulator } from "./cost";

/** Build a boundary stub whose generateContent yields the queued responses. */
function fakeBoundary(
  responses: Array<GenAIResponse | (() => never)>,
): { boundary: GenAIBoundary; calls: Array<Record<string, unknown>> } {
  const calls: Array<Record<string, unknown>> = [];
  let i = 0;
  const generateContent = async (
    params: Parameters<GenAIBoundary["models"]["generateContent"]>[0],
  ): Promise<GenAIResponse> => {
    calls.push(params as Record<string, unknown>);
    const next = responses[i++];
    if (typeof next === "function") next();
    return next as GenAIResponse;
  };
  return {
    boundary: { models: { generateContent: vi.fn(generateContent) } },
    calls,
  };
}

function usage(input: number, output: number) {
  return {
    promptTokenCount: input,
    candidatesTokenCount: output,
    totalTokenCount: input + output,
  };
}

// A trivial schema validator: requires { title: string }.
const titleSchema = {
  jsonSchema: { type: "object", properties: { title: { type: "string" } } },
  parse(value: unknown): { title: string } {
    if (
      typeof value !== "object" ||
      value === null ||
      typeof (value as { title?: unknown }).title !== "string"
    ) {
      throw new Error("title must be a string");
    }
    return value as { title: string };
  },
};

describe("GeminiClient.generateJSON", () => {
  it("returns a schema-valid object and reports usage + cost", async () => {
    const { boundary, calls } = fakeBoundary([
      { text: JSON.stringify({ title: "Hello" }), usageMetadata: usage(100, 50) },
    ]);
    const client = new GeminiClient(boundary);

    const result = await client.generateJSON({
      useCase: "generation",
      operation: "full_site_generation",
      schema: titleSchema,
      systemInstruction: "rules here",
      prompt: "make a homepage",
    });

    expect(result.data).toEqual({ title: "Hello" });
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 50 });
    expect(result.model).toBe(GEMINI_MODELS.pro);
    expect(result.costUsd).toBeGreaterThan(0);
    // Routed to Pro, asked for JSON mime type, system instruction passed through.
    expect(calls[0].model).toBe(GEMINI_MODELS.pro);
  });

  it("repairs malformed output with a second call, then succeeds (§8.2.3)", async () => {
    const { boundary } = fakeBoundary([
      { text: "Sure! Here is your JSON: {bad", usageMetadata: usage(80, 40) },
      { text: JSON.stringify({ title: "Fixed" }), usageMetadata: usage(120, 30) },
    ]);
    const client = new GeminiClient(boundary);

    const result = await client.generateJSON({
      useCase: "generation",
      operation: "full_site_generation",
      schema: titleSchema,
      prompt: "x",
    });

    expect(result.data).toEqual({ title: "Fixed" });
    // Cost accounts for BOTH attempts.
    expect(result.usage.inputTokens).toBe(200);
    expect(result.usage.outputTokens).toBe(70);
  });

  it("throws SchemaValidationError (never free text) when repair also fails", async () => {
    const { boundary } = fakeBoundary([
      { text: "not json", usageMetadata: usage(80, 40) },
      { text: "still not json", usageMetadata: usage(80, 40) },
    ]);
    const client = new GeminiClient(boundary);

    await expect(
      client.generateJSON({
        useCase: "validation",
        operation: "compliance_layer2",
        schema: titleSchema,
        prompt: "x",
      }),
    ).rejects.toBeInstanceOf(SchemaValidationError);
  });

  it("extracts JSON from a fenced ```json block", async () => {
    const { boundary } = fakeBoundary([
      {
        text: "```json\n{\"title\":\"Fenced\"}\n```",
        usageMetadata: usage(50, 20),
      },
    ]);
    const client = new GeminiClient(boundary);
    const result = await client.generateJSON({
      useCase: "edit",
      operation: "post_launch_edit",
      schema: titleSchema,
      prompt: "x",
    });
    expect(result.data).toEqual({ title: "Fenced" });
  });

  it("maps a 429 from the SDK to a typed GeminiRateLimitError (009 seam)", async () => {
    const { boundary } = fakeBoundary([
      () => {
        const e = new Error("Resource exhausted") as Error & { status: number };
        e.status = 429;
        throw e;
      },
    ]);
    const client = new GeminiClient(boundary);

    await expect(
      client.generateJSON({
        useCase: "generation",
        operation: "full_site_generation",
        schema: titleSchema,
        prompt: "x",
      }),
    ).rejects.toBeInstanceOf(GeminiRateLimitError);
  });

  it("rate-limit error carries the model and is retryable", async () => {
    const { boundary } = fakeBoundary([
      () => {
        const e = new Error("overloaded") as Error & { status: number };
        e.status = 503;
        throw e;
      },
    ]);
    const client = new GeminiClient(boundary);
    try {
      await client.generateJSON({
        useCase: "validation",
        operation: "compliance_layer2",
        schema: titleSchema,
        prompt: "x",
      });
      throw new Error("should have thrown");
    } catch (e) {
      const err = e as GeminiRateLimitError;
      expect(err).toBeInstanceOf(GeminiRateLimitError);
      expect(err.retryable).toBe(true);
      expect(err.model).toBe(GEMINI_MODELS.flash);
      expect(err.code).toBe("gemini_rate_limited");
    }
  });

  it("fails loud when output exceeds the hard cap (no silent truncation)", async () => {
    const { boundary } = fakeBoundary([
      { text: JSON.stringify({ title: "x" }), usageMetadata: usage(100, 99_999) },
    ]);
    const client = new GeminiClient(boundary);
    await expect(
      client.generateJSON({
        useCase: "edit",
        operation: "post_launch_edit",
        schema: titleSchema,
        prompt: "x",
      }),
    ).rejects.toBeInstanceOf(TokenBudgetExceededError);
  });

  it("records cost into an injected per-site accumulator", async () => {
    const { boundary } = fakeBoundary([
      { text: JSON.stringify({ title: "A" }), usageMetadata: usage(100, 50) },
      { text: JSON.stringify({ title: "B" }), usageMetadata: usage(200, 60) },
    ]);
    const acc = new CostAccumulator();
    const client = new GeminiClient(boundary, { costAccumulator: acc });

    await client.generateJSON({
      useCase: "generation",
      operation: "full_site_generation",
      schema: titleSchema,
      prompt: "x",
    });
    await client.generateJSON({
      useCase: "validation",
      operation: "compliance_layer2",
      schema: titleSchema,
      prompt: "y",
    });

    const snap = acc.snapshot();
    expect(snap.callCount).toBe(2);
    expect(snap.totalInputTokens).toBe(300);
    expect(snap.totalUsd).toBeGreaterThan(0);
  });
});
