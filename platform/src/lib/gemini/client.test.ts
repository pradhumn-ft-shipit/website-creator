import { describe, expect, it, vi } from "vitest";

import {
  GeminiClient,
  type GenAIBoundary,
  type GenAIResponse,
} from "./client";
import {
  CostBudgetExceededError,
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

  it("forwards inline file parts alongside the prompt (PDF intake, §4.2)", async () => {
    const { boundary, calls } = fakeBoundary([
      { text: JSON.stringify({ title: "FromPdf" }), usageMetadata: usage(100, 50) },
    ]);
    const client = new GeminiClient(boundary);

    const result = await client.generateJSON({
      useCase: "intake",
      operation: "intake_extraction",
      schema: titleSchema,
      prompt: "extract fields",
      files: [{ mimeType: "application/pdf", data: "QkFTRTY0" }],
    });

    expect(result.data).toEqual({ title: "FromPdf" });
    // contents became a parts array: the prompt text + the inline PDF part.
    const contents = calls[0].contents as {
      role: string;
      parts: Array<Record<string, unknown>>;
    };
    expect(contents.role).toBe("user");
    expect(contents.parts).toEqual([
      { text: "extract fields" },
      { inlineData: { mimeType: "application/pdf", data: "QkFTRTY0" } },
    ]);
  });

  it("sends a bare string when no files are attached (back-compat)", async () => {
    const { boundary, calls } = fakeBoundary([
      { text: JSON.stringify({ title: "x" }), usageMetadata: usage(10, 5) },
    ]);
    const client = new GeminiClient(boundary);
    await client.generateJSON({
      useCase: "intake",
      operation: "intake_extraction",
      schema: titleSchema,
      prompt: "no files",
    });
    expect(calls[0].contents).toBe("no files");
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

describe("GeminiClient cost guard — accounting + enforcement", () => {
  // #1 — token spend must be recorded for EVERY attempt that hit the wire, not
  // just the one that parsed, or the $2 guard undercounts and a site overspends.

  it("records token spend for an over-cap attempt even though it throws (#1)", async () => {
    // Output (9_999) blows the post_launch_edit cap (1_500) → the call throws,
    // but it already reached the wire and was billed.
    const { boundary } = fakeBoundary([
      { text: JSON.stringify({ title: "x" }), usageMetadata: usage(200, 9_999) },
    ]);
    const acc = new CostAccumulator();
    const client = new GeminiClient(boundary, { costAccumulator: acc });

    await expect(
      client.generateJSON({
        useCase: "edit",
        operation: "post_launch_edit",
        schema: titleSchema,
        prompt: "x",
      }),
    ).rejects.toBeInstanceOf(TokenBudgetExceededError);

    const snap = acc.snapshot();
    expect(snap.callCount).toBe(1);
    expect(snap.totalInputTokens).toBe(200);
    expect(snap.totalOutputTokens).toBe(9_999);
    expect(snap.totalUsd).toBeGreaterThan(0);
  });

  it("records spend for EVERY attempt when all repairs fail (#1)", async () => {
    const { boundary } = fakeBoundary([
      { text: "not json", usageMetadata: usage(80, 40) },
      { text: "still not json", usageMetadata: usage(90, 30) },
    ]);
    const acc = new CostAccumulator();
    const client = new GeminiClient(boundary, { costAccumulator: acc });

    await expect(
      client.generateJSON({
        useCase: "validation",
        operation: "compliance_layer2",
        schema: titleSchema,
        prompt: "x",
      }),
    ).rejects.toBeInstanceOf(SchemaValidationError);

    const snap = acc.snapshot();
    // Both the initial call and the repair attempt are billed.
    expect(snap.callCount).toBe(2);
    expect(snap.totalInputTokens).toBe(170);
    expect(snap.totalOutputTokens).toBe(70);
  });

  it("a failed image attempt bills tokens but does NOT burn image quota (#1)", async () => {
    const { boundary } = fakeBoundary([
      { text: "not json", usageMetadata: usage(50, 40) },
      { text: "still not json", usageMetadata: usage(50, 40) },
    ]);
    const acc = new CostAccumulator();
    const client = new GeminiClient(boundary, { costAccumulator: acc });

    await expect(
      client.generateJSON({
        useCase: "image",
        operation: "image_generation",
        schema: titleSchema,
        prompt: "x",
      }),
    ).rejects.toBeInstanceOf(SchemaValidationError);

    const snap = acc.snapshot();
    expect(snap.imageCount).toBe(0); // quota untouched by a failed image
    expect(snap.totalInputTokens).toBe(100); // but the tokens were billed
  });

  it("a successful image consumes exactly one image-quota unit", async () => {
    const { boundary } = fakeBoundary([
      { text: JSON.stringify({ title: "img" }), usageMetadata: usage(50, 40) },
    ]);
    const acc = new CostAccumulator();
    const client = new GeminiClient(boundary, { costAccumulator: acc });

    await client.generateJSON({
      useCase: "image",
      operation: "image_generation",
      schema: titleSchema,
      prompt: "x",
    });
    expect(acc.snapshot().imageCount).toBe(1);
  });

  // #2 — the guard must HALT a call before it dispatches once the cap/quota is
  // reached, not merely record the overage after the fact.

  it("halts at the $2 cap BEFORE dispatching, so nothing is billed (#2)", async () => {
    const { boundary, calls } = fakeBoundary([
      {
        text: JSON.stringify({ title: "never reached" }),
        usageMetadata: usage(100, 50),
      },
    ]);
    // A cap so low that any further call would exceed it.
    const acc = new CostAccumulator(0.0001);
    const client = new GeminiClient(boundary, { costAccumulator: acc });

    await expect(
      client.generateJSON({
        useCase: "generation",
        operation: "full_site_generation",
        schema: titleSchema,
        prompt: "x",
      }),
    ).rejects.toBeInstanceOf(CostBudgetExceededError);
    // Proven halt: the SDK boundary was never called.
    expect(calls).toHaveLength(0);
    expect(acc.snapshot().callCount).toBe(0);
  });

  it("halts the 4th image at the quota cap BEFORE dispatching (#2)", async () => {
    const { boundary, calls } = fakeBoundary([
      { text: JSON.stringify({ title: "4th" }), usageMetadata: usage(50, 40) },
    ]);
    const acc = new CostAccumulator();
    acc.recordImage(); // site already spent its 3-image quota
    acc.recordImage();
    acc.recordImage();
    const client = new GeminiClient(boundary, { costAccumulator: acc });

    await expect(
      client.generateJSON({
        useCase: "image",
        operation: "image_generation",
        schema: titleSchema,
        prompt: "x",
      }),
    ).rejects.toBeInstanceOf(CostBudgetExceededError);
    expect(calls).toHaveLength(0);
  });
});

/** A flash-image response: inline image bytes on the first candidate's parts. */
function imageResponse(
  b64: string,
  mimeType: string,
  input: number,
  output: number,
): GenAIResponse {
  return {
    candidates: [
      { content: { parts: [{ inlineData: { mimeType, data: b64 } }] } },
    ],
    usageMetadata: usage(input, output),
  };
}

describe("GeminiClient.generateImage (§6.7 capped AI images)", () => {
  it("returns the inline image bytes + mime, routed to the flash-image model", async () => {
    const { boundary, calls } = fakeBoundary([
      imageResponse("aW1hZ2VieXRlcw==", "image/png", 60, 1290),
    ]);
    const client = new GeminiClient(boundary);

    const result = await client.generateImage({
      prompt: "abstract emerald gradient",
    });

    expect(result.data).toBe("aW1hZ2VieXRlcw==");
    expect(result.mimeType).toBe("image/png");
    expect(result.model).toBe(GEMINI_MODELS.flashImage);
    expect(result.usage.outputTokens).toBe(1290);
    expect(result.costUsd).toBeGreaterThan(0);
    // Requested the image modality from the image model.
    expect(calls[0].model).toBe(GEMINI_MODELS.flashImage);
  });

  it("consumes exactly one image-quota unit on success", async () => {
    const { boundary } = fakeBoundary([
      imageResponse("Ym9keQ==", "image/jpeg", 60, 1290),
    ]);
    const acc = new CostAccumulator();
    const client = new GeminiClient(boundary, { costAccumulator: acc });

    await client.generateImage({ prompt: "calm nature landscape" });
    expect(acc.snapshot().imageCount).toBe(1);
  });

  it("halts the 4th image at the quota cap BEFORE dispatching", async () => {
    const { boundary, calls } = fakeBoundary([
      imageResponse("eA==", "image/png", 60, 1290),
    ]);
    const acc = new CostAccumulator();
    acc.recordImage();
    acc.recordImage();
    acc.recordImage();
    const client = new GeminiClient(boundary, { costAccumulator: acc });

    await expect(
      client.generateImage({ prompt: "office interior" }),
    ).rejects.toBeInstanceOf(CostBudgetExceededError);
    expect(calls).toHaveLength(0);
  });

  it("throws (never returns free text) when the response carries no image", async () => {
    const { boundary } = fakeBoundary([
      { text: "sorry, no image", usageMetadata: usage(60, 20) },
    ]);
    const client = new GeminiClient(boundary);

    await expect(
      client.generateImage({ prompt: "abstract pattern" }),
    ).rejects.toBeInstanceOf(SchemaValidationError);
  });

  it("maps a 429 during image generation to a typed rate-limit error", async () => {
    const { boundary } = fakeBoundary([
      () => {
        const e = new Error("quota") as Error & { status: number };
        e.status = 429;
        throw e;
      },
    ]);
    const client = new GeminiClient(boundary);
    await expect(
      client.generateImage({ prompt: "nature scene" }),
    ).rejects.toBeInstanceOf(GeminiRateLimitError);
  });
});
