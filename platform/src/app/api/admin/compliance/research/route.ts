import { apiHandler, AppError } from "@/lib/api/envelope";
import { assertAdmin } from "@/lib/admin/auth";
import { runResearchAgentWired } from "@/lib/admin/compliance";

/**
 * POST /api/admin/compliance/research — trigger the research agent (PRD §5.7).
 * Admin-only. Runs Gemini 2.5 Pro + web search over regulator sources and
 * returns a STRUCTURED, CITED diff proposal. It NEVER publishes and never even
 * persists — the operator reviews the proposal, then creates a draft from it.
 */
export const POST = apiHandler(async () => {
  await assertAdmin();
  if (!process.env.GEMINI_API_KEY) {
    throw new AppError(
      "Research agent unavailable: GEMINI_API_KEY is not configured.",
      "research_unavailable",
      503,
    );
  }
  const proposal = await runResearchAgentWired();
  return { proposal };
});
