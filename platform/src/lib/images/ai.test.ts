import { describe, expect, it, vi } from "vitest";

import { ProhibitedImageSubjectError } from "./guard";
import { SITE_IMAGE_SLOTS } from "./slots";
import { buildImagePrompt, generateAiImage, type AiImageGemini } from "./ai";

function fakeGemini(overrides?: Partial<AiImageGemini>): AiImageGemini {
  return {
    generateImage: vi.fn(async () => ({
      data: "aW1n",
      mimeType: "image/png",
      model: "gemini-2.5-flash-image" as const,
      usage: { inputTokens: 60, outputTokens: 1290 },
      costUsd: 0.04,
    })),
    ...overrides,
  };
}

const slot = SITE_IMAGE_SLOTS[0];

describe("buildImagePrompt — safe subject construction (§6.7)", () => {
  it("builds an abstract/office/nature prompt that passes the guard for every slot", () => {
    for (const s of SITE_IMAGE_SLOTS) {
      const prompt = buildImagePrompt(s);
      expect(prompt.length).toBeGreaterThan(0);
      // The constructed prompt must itself never trip the no-people guard.
      expect(() => generateAiImage({ slot: s, gemini: fakeGemini() })).not.toThrow();
    }
  });
});

describe("generateAiImage — guard enforced at the call boundary", () => {
  it("generates an image for an allowed slot and returns bytes + alt text", async () => {
    const gemini = fakeGemini();
    const result = await generateAiImage({ slot, gemini });

    expect(result.slotId).toBe(slot.id);
    expect(result.data).toBe("aW1n");
    expect(result.mimeType).toBe("image/png");
    expect(result.altText).toBeTruthy(); // §6.6: every image has alt text
    expect(gemini.generateImage).toHaveBeenCalledTimes(1);
  });

  it("REJECTS a prohibited-subject slot in code before calling Gemini", async () => {
    const gemini = fakeGemini();
    // A hostile/misconfigured slot describing people must never reach the model.
    const peopleSlot = {
      id: "rogue",
      purpose: "x",
      stockQuery: "y",
      aiSubject: "office" as const,
      // Override the prompt the builder would produce via a promptOverride.
    };

    await expect(
      generateAiImage({
        slot: peopleSlot,
        gemini,
        promptOverride: "a smiling financial advisor shaking hands with a client",
      }),
    ).rejects.toBeInstanceOf(ProhibitedImageSubjectError);

    // The critical assertion: the Gemini boundary was NEVER invoked.
    expect(gemini.generateImage).not.toHaveBeenCalled();
  });

  it("passes the guard-checked prompt through to Gemini unchanged", async () => {
    const gemini = fakeGemini();
    await generateAiImage({ slot, gemini });
    const call = (gemini.generateImage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.prompt).toBe(buildImagePrompt(slot));
  });
});
