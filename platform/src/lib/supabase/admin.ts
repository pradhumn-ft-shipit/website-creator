import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

/**
 * Service-role Supabase client. Bypasses RLS — server-only, NEVER importable
 * into client code (uses SUPABASE_SERVICE_ROLE_KEY). Use for trusted internal
 * work that legitimately spans all accounts: admin tooling, system pipeline
 * steps (Inngest), and diagnostics like the /api/health/db probe.
 *
 * For anything acting on behalf of a signed-in advisor, use the cookie-bound
 * server client in `./server.ts` so RLS scopes the data to their account.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See platform/.env.example.`,
    );
  }
  return value;
}
