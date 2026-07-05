import { apiHandler, AppError } from "@/lib/api/envelope";
import { readJson } from "@/lib/api/request";
import { finalizeAndBuild, isTemplateId, selectTemplate } from "@/lib/intake";
import { inngest } from "@/lib/inngest/client";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/onboarding/template — the last intake screen (§4.1.9, §6.1).
 *   - `{ templateId }`  → persist the chosen template to the account's site.
 *   - `{ action: "build" }` → "Build my site" (§4.1.14): emit `order.created`.
 * The build enqueue lives here (not at checkout) per the 013 flow decision — it
 * fires only after the advisor has confirmed everything and picked a template.
 */
export const POST = apiHandler(async (request) => {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new AppError("Please sign in to continue.", "unauthenticated", 401);
  const deps = { client: client as never, userId: user.id };

  const body = await readJson<{ templateId?: unknown; action?: unknown }>(request);

  if (body.action === "build") {
    return finalizeAndBuild({ ...deps, send: (event) => inngest.send(event) });
  }

  if (!isTemplateId(body.templateId)) {
    throw new AppError("Pick one of the three templates.", "invalid_template", 400);
  }
  return selectTemplate(deps, body.templateId);
});
