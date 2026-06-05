import { apiHandler } from "@/lib/api/envelope";
import { asString, readJson } from "@/lib/api/request";
import { createClient } from "@/lib/supabase/server";
import { joinWaitlist } from "@/lib/waitlist/service";

/**
 * POST /api/waitlist — { email, industry } (ticket 011, PRD §2.2).
 * Public capture from the four non-RIA industry cards — no account required.
 * The anon client's insert is allowed by the `waitlist_public_insert` policy;
 * the unique (email, industry) index makes re-submits a silent no-op.
 */
export const POST = apiHandler(async (request) => {
  const body = await readJson(request);
  const client = await createClient();
  return joinWaitlist(client as never, {
    email: asString(body.email),
    industry: asString(body.industry),
  });
});
