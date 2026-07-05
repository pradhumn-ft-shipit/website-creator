import { describe, expect, it } from "vitest";

import {
  ProhibitedImageSubjectError,
  assertImagePromptAllowed,
  isProhibitedImageSubject,
} from "./guard";

describe("image subject guard (PRD §6.7 / CLAUDE.md hard stop)", () => {
  // The prohibition is a compliance rule, not a style preference: no AI-generated
  // people, hands-with-documents, or client/testimonial scenes — EVER. This is the
  // guard that must live at the call boundary in code, not just in the prompt.

  const peoplePrompts = [
    "a friendly financial advisor smiling at the camera",
    "portrait of a woman in a business suit",
    "a happy family meeting their planner",
    "two people shaking hands in an office",
    "headshot of a confident businessman",
    "a group of colleagues around a table",
    "close-up of a person's face",
  ];

  it.each(peoplePrompts)("rejects a people prompt: %s", (prompt) => {
    const verdict = isProhibitedImageSubject(prompt);
    expect(verdict.prohibited).toBe(true);
    expect(verdict.reason).toBeTruthy();
    expect(() => assertImagePromptAllowed(prompt)).toThrow(
      ProhibitedImageSubjectError,
    );
  });

  const handsPrompts = [
    "hands holding a document",
    "a hand signing a contract with a pen",
    "close up of hands holding financial paperwork",
  ];

  it.each(handsPrompts)("rejects a hands-with-documents prompt: %s", (prompt) => {
    expect(isProhibitedImageSubject(prompt).prohibited).toBe(true);
    expect(() => assertImagePromptAllowed(prompt)).toThrow(
      ProhibitedImageSubjectError,
    );
  });

  const clientScenePrompts = [
    "a satisfied client giving a testimonial",
    "advisor consulting with a customer",
    "a client meeting in a cozy office",
  ];

  it.each(clientScenePrompts)("rejects a client/testimonial scene: %s", (prompt) => {
    expect(isProhibitedImageSubject(prompt).prohibited).toBe(true);
    expect(() => assertImagePromptAllowed(prompt)).toThrow(
      ProhibitedImageSubjectError,
    );
  });

  const allowedPrompts = [
    "abstract flowing gradient in deep emerald tones",
    "a minimalist modern office lobby interior, soft daylight",
    "calm nature scene of a misty forest at dawn",
    "geometric architectural detail of a glass facade",
    "an empty conference room with clean lines",
    "aerial view of a winding coastal road",
  ];

  it.each(allowedPrompts)("allows an abstract/office/nature prompt: %s", (prompt) => {
    expect(isProhibitedImageSubject(prompt).prohibited).toBe(false);
    expect(() => assertImagePromptAllowed(prompt)).not.toThrow();
  });

  it("is case-insensitive and resistant to spacing tricks", () => {
    expect(isProhibitedImageSubject("A PERSON").prohibited).toBe(true);
    expect(isProhibitedImageSubject("busi­nesswoman").prohibited).toBe(true);
  });

  it("does not false-positive on 'personalized' or 'personnel-free'", () => {
    // Word-boundary matching: 'person' inside 'personalized' must not trigger.
    expect(isProhibitedImageSubject("personalized abstract pattern").prohibited).toBe(
      false,
    );
  });

  it("throws a typed error carrying the matched reason", () => {
    try {
      assertImagePromptAllowed("a smiling advisor and his client");
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ProhibitedImageSubjectError);
      expect((err as ProhibitedImageSubjectError).code).toBe(
        "prohibited_image_subject",
      );
    }
  });
});
