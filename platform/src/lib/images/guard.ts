/**
 * The AI-image subject guard (PRD §6.7, CLAUDE.md hard stop).
 *
 * AI-generated people, hands-holding-documents, and client/testimonial scenes are
 * a **compliance prohibition** (SEC marketing-rule risk), not a style preference.
 * The prohibition MUST be enforced in code at the call boundary — a prompt
 * instruction alone can be ignored by the model or bypassed by a caller. Every
 * path to `GeminiClient.generateImage` runs `assertImagePromptAllowed` first, so
 * no request describing a person can ever reach the image model.
 *
 * Matching is word-boundary + case-insensitive over a normalized prompt, so
 * "person" triggers on "a person" but not on "personalized"; soft hyphens and odd
 * spacing are stripped so "busi­nesswoman" can't slip through.
 */

import { AppError } from "@/lib/api/envelope";

/** Thrown when an image prompt describes a prohibited subject. */
export class ProhibitedImageSubjectError extends AppError {
  constructor(reason: string) {
    super(
      `AI image subject is prohibited (§6.7): ${reason}. ` +
        "No AI-generated people, hands-with-documents, or client scenes — ever.",
      "prohibited_image_subject",
      422,
    );
    this.name = "ProhibitedImageSubjectError";
  }
}

/**
 * Terms that describe people, human body parts in a document context, or
 * client/advisor scenes. Any single hit disqualifies the prompt. Kept broad on
 * purpose: a false positive costs at most one abstract fallback; a false negative
 * ships a prohibited image. Bias hard toward rejection.
 */
const PROHIBITED_TERMS: readonly string[] = [
  // People — singular/plural nouns and roles.
  "person",
  "people",
  "man",
  "men",
  "woman",
  "women",
  "boy",
  "girl",
  "child",
  "children",
  "kid",
  "human",
  "humans",
  "face",
  "faces",
  "portrait",
  "headshot",
  "smiling",
  "smile",
  "family",
  "couple",
  "colleague",
  "colleagues",
  "team member",
  "businessman",
  "businesswoman",
  "businessperson",
  "businesspeople",
  "professional", // "a professional" almost always implies a depicted person here
  "advisor",
  "adviser",
  "planner",
  "client",
  "clients",
  "customer",
  "customers",
  "testimonial",
  "employee",
  "employees",
  "staff",
  "personnel",
  "worker",
  "workers",
  // Hands / body parts (the "hands holding documents" prohibition).
  "hand",
  "hands",
  "finger",
  "fingers",
  "arm",
  "arms",
  "shoulder",
  // Scene verbs that imply depicted humans interacting.
  "shaking hands",
  "handshake",
  "meeting with",
  "consulting with",
  "consultation",
  "sitting together",
];

/** Strip zero-width / soft-hyphen chars and collapse whitespace, lowercased. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[­​-‍﻿]/g, "") // soft hyphen + zero-width
    .replace(/\s+/g, " ")
    .trim();
}

/** Escape a term for use inside a RegExp. */
function escapeRegExp(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface SubjectVerdict {
  prohibited: boolean;
  /** The matched term, present only when `prohibited`. */
  reason?: string;
}

/**
 * Decide whether an image prompt describes a prohibited subject. Word-boundary
 * matched so "person" ≠ "personalized". Returns the offending term as `reason`.
 */
export function isProhibitedImageSubject(prompt: string): SubjectVerdict {
  const text = normalize(prompt);
  for (const term of PROHIBITED_TERMS) {
    const t = escapeRegExp(term.toLowerCase());
    // \b works for word-char boundaries; multi-word terms already carry spaces.
    const re = new RegExp(`(^|[^a-z])${t}([^a-z]|$)`, "i");
    if (re.test(text)) {
      return { prohibited: true, reason: term };
    }
  }
  return { prohibited: false };
}

/**
 * Hard gate: throw `ProhibitedImageSubjectError` if the prompt describes a
 * prohibited subject. Call this immediately before dispatching ANY image
 * generation request — it is the code-level enforcement of the §6.7 hard stop.
 */
export function assertImagePromptAllowed(prompt: string): void {
  const verdict = isProhibitedImageSubject(prompt);
  if (verdict.prohibited) {
    throw new ProhibitedImageSubjectError(verdict.reason ?? "unknown subject");
  }
}
