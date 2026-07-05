/**
 * AI image generation boundary (PRD §6.7) — the ONLY path from the pipeline to
 * the flash-image model. It is here, at the single call site, that the §6.7
 * subject prohibition is enforced in code: `assertImagePromptAllowed` runs before
 * `gemini.generateImage` is ever called, so a prompt describing people, hands-
 * with-documents, or a client scene throws and never reaches the model.
 *
 * Prompts are constructed from a constrained abstract/office/nature vocabulary
 * (`buildImagePrompt`) so the input is safe by construction; the guard is the
 * defense-in-depth backstop for a misconfigured slot or a `promptOverride`.
 */

import type { GenerateImageResult } from "@/lib/gemini";

import { assertImagePromptAllowed } from "./guard";
import type { AiSubject, ImageSlot } from "./slots";

/** The one Gemini capability this boundary needs (the real client satisfies it). */
export type AiImageGemini = {
  generateImage(opts: {
    prompt: string;
    systemInstruction?: string;
  }): Promise<GenerateImageResult>;
};

export interface AiImage {
  slotId: string;
  /** base64-encoded image bytes. */
  data: string;
  mimeType: string;
  /** WCAG alt text (§6.6) describing the decorative subject. */
  altText: string;
  /** The exact (guard-checked) prompt sent to the model, for the manifest/audit. */
  prompt: string;
  usage: GenerateImageResult["usage"];
  costUsd: number;
}

/** Shared style steering: flat, no text, no people — abstract decoration only. */
const STYLE_SYSTEM_INSTRUCTION =
  "Produce a clean, professional, minimalist image suitable as a subtle website " +
  "background or section accent. No text, no logos, no watermarks. " +
  "Absolutely no people, no faces, no hands, no human figures of any kind.";

/** Subject → a safe, descriptive base phrase (never references humans). */
const SUBJECT_PHRASE: Record<AiSubject, string> = {
  abstract:
    "A minimalist abstract composition of soft flowing shapes and gentle gradients",
  office:
    "A calm, empty modern office interior with clean architectural lines and soft daylight",
  nature:
    "A serene wide nature landscape with a calm horizon and muted natural tones",
};

/** Subject → concise alt text (§6.6). */
const SUBJECT_ALT: Record<AiSubject, string> = {
  abstract: "Abstract decorative background graphic",
  office: "Photograph of a modern, unoccupied office interior",
  nature: "Calm natural landscape used as a decorative background",
};

/** Build a safe image prompt for a slot from the constrained subject vocabulary. */
export function buildImagePrompt(slot: Pick<ImageSlot, "aiSubject" | "purpose">): string {
  return (
    `${SUBJECT_PHRASE[slot.aiSubject]}, in a refined, muted color palette. ` +
    "Suitable as an unobtrusive website background."
  );
}

export interface GenerateAiImageArgs {
  slot: ImageSlot;
  gemini: AiImageGemini;
  /** Escape hatch for tests / future callers; still passes through the guard. */
  promptOverride?: string;
}

/**
 * Generate one AI image for a slot. Guards the prompt at the call boundary, then
 * dispatches to the (cost/quota-capped) Gemini image client. Never returns an
 * image for a prohibited subject — it throws first.
 */
export async function generateAiImage(args: GenerateAiImageArgs): Promise<AiImage> {
  const prompt = args.promptOverride ?? buildImagePrompt(args.slot);

  // HARD STOP — enforced in code, before any model call (§6.7 / CLAUDE.md).
  assertImagePromptAllowed(prompt);

  const result = await args.gemini.generateImage({
    prompt,
    systemInstruction: STYLE_SYSTEM_INSTRUCTION,
  });

  return {
    slotId: args.slot.id,
    data: result.data,
    mimeType: result.mimeType,
    altText: SUBJECT_ALT[args.slot.aiSubject],
    prompt,
    usage: result.usage,
    costUsd: result.costUsd,
  };
}
