import { apiHandler, AppError } from "@/lib/api/envelope";
import { readJson } from "@/lib/api/request";
import { createClient } from "@/lib/supabase/server";
import {
  readIntakeForConfirm,
  saveQuickQuestions,
  saveRoundOneCorrections,
  saveRoundTwo,
  type AumBucket,
  type ConfirmDeps,
  type QuickQuestions,
  type RoundOneCorrection,
  type RoundTwoAnswers,
} from "@/lib/intake";

/** Resolve the confirm deps from the request: cookie-bound RLS client + user id. */
async function resolveDeps(): Promise<ConfirmDeps> {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new AppError("Please sign in to continue.", "unauthenticated", 401);
  return { client: client as never, userId: user.id };
}

/**
 * GET /api/onboarding/intake — the extracted Round-1 blob + account identity
 * facts that the confirm-or-correct screen renders (§4.1.10). RLS scopes it to
 * the signed-in advisor's own order.
 */
export const GET = apiHandler(async () => readIntakeForConfirm(await resolveDeps()));

/**
 * POST /api/onboarding/intake — one write endpoint for the three intake-capture
 * screens, discriminated by `kind`:
 *   - `quick`       → §4.1.8 quick questions (AUM → SEC/state, CRD, custodian…)
 *   - `corrections` → §4.1.10 Round-1 confirm-or-correct edits
 *   - `round2`      → §4.1.12 Round-2 answers
 * Auto-save per §7.7 — each screen posts before advancing.
 */
export const POST = apiHandler(async (request) => {
  const body = await readJson<{ kind?: string } & Record<string, unknown>>(request);
  const deps = await resolveDeps();

  switch (body.kind) {
    case "quick":
      return saveQuickQuestions(deps, readQuick(body));
    case "corrections":
      return saveRoundOneCorrections(deps, readCorrections(body));
    case "round2":
      return saveRoundTwo(deps, (body.answers ?? {}) as RoundTwoAnswers);
    default:
      throw new AppError("Unknown intake step.", "invalid_input", 400);
  }
});

function readQuick(body: Record<string, unknown>): QuickQuestions {
  const aum = body.aumBucket;
  if (aum !== "under_100m" && aum !== "over_100m") {
    throw new AppError("Tell us your AUM range.", "invalid_input", 400);
  }
  const q: QuickQuestions = { aumBucket: aum as AumBucket };
  if (typeof body.primaryState === "string") q.primaryState = body.primaryState;
  if (typeof body.crdNumber === "string") q.crdNumber = body.crdNumber;
  if (typeof body.custodian === "string") q.custodian = body.custodian;
  if (Array.isArray(body.designations)) q.designations = body.designations.filter((d): d is string => typeof d === "string");
  return q;
}

function readCorrections(body: Record<string, unknown>): RoundOneCorrection[] {
  const raw = Array.isArray(body.corrections) ? body.corrections : [];
  return raw
    .filter((c): c is { field: string; value: unknown } => typeof c === "object" && c !== null && "field" in c)
    .map((c) => ({ field: c.field as RoundOneCorrection["field"], value: c.value }));
}
