import { apiHandler } from "@/lib/api/envelope";
import { getDbHealth, type CountableClient } from "@/lib/health";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * DB readiness probe: per-table row counts through the {data,error} envelope.
 * The ticket-002 round-trip proof — after seeding, the seeded user→account→
 * order chain shows up here. Uses the service-role client so counts aren't
 * masked by RLS. No hand-built envelope; `apiHandler` shapes the response.
 */
export const GET = apiHandler(async () =>
  getDbHealth(createAdminClient() as unknown as CountableClient),
);
