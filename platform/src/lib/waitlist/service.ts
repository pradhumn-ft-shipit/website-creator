/**
 * Waitlist IO (PRD §2.2, ticket 011). The four non-RIA industry cards capture an
 * email so we can sequence the next vertical. The capture form is public (no
 * account required, §4.1 is RIA-only), so the route passes the anon client and
 * the `waitlist_public_insert` policy (migration 20260605…) allows the insert
 * while keeping the table unreadable to end users.
 *
 * Idempotency rides on the `(email, industry)` unique index: a duplicate submit
 * is silently ignored (`ignoreDuplicates`) rather than erroring, so the advisor
 * always sees the same "you're on the list" confirmation. We can't read back the
 * row (no select policy), so the result is intentionally generic.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { AppError } from "@/lib/api/envelope";
import type { Database } from "@/types/database.types";
import { normalizeWaitlistEmail, validateWaitlist, type WaitlistInput } from "./validate";

type DbClient = SupabaseClient<Database>;

export async function joinWaitlist(
  client: DbClient,
  input: WaitlistInput,
): Promise<{ status: "joined" }> {
  const invalid = validateWaitlist(input);
  if (invalid) throw new AppError(invalid, "invalid_input", 400);

  const email = normalizeWaitlistEmail(input.email);

  const { error } = await client
    .from("waitlist")
    .upsert(
      { email, industry: input.industry },
      { onConflict: "email,industry", ignoreDuplicates: true },
    );
  if (error) throw error;

  return { status: "joined" };
}
