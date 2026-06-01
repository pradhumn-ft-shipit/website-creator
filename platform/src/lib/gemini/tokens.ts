/**
 * Cheap, offline token estimate for the pre-flight input cap (§8.2.7). The real
 * input count comes back in usageMetadata; this is only a guard so we can reject
 * an obviously-over-cap prompt BEFORE spending a call. Heuristic: ~4 chars/token
 * (Gemini/Gemma tokenizers average close to this for English) with a small
 * per-word floor so whitespace-heavy text isn't undercounted.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const byChars = Math.ceil(text.length / 4);
  const byWords = Math.ceil(text.trim().split(/\s+/).length * 1.3);
  return Math.max(byChars, byWords);
}
