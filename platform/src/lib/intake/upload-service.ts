/**
 * Docs-upload service (PRD §4.2/§4.3) — glues the authenticated request to
 * `storeDocs`. Ownership is enforced by reading the advisor's account + order
 * through the cookie-bound RLS client (it only returns rows they own); the
 * actual Storage write + intake_data update then run on the service-role admin
 * client, because the `intake-docs` bucket is private with no per-object policy
 * (012 migration). Split out from the route so it's unit-testable without a
 * multipart request.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { AppError } from "@/lib/api/envelope";
import type { Database } from "@/types/database.types";

import { storeDocs, type UploadFileInput } from "./upload";

type DbClient = SupabaseClient<Database>;

export interface UploadDocsDeps {
  /** Cookie-bound, RLS-scoped client — used to prove order ownership. */
  rls: DbClient;
  /** Service-role client — used for the private-bucket write + intake update. */
  admin: DbClient;
  userId: string;
  files: UploadFileInput[];
}

export async function uploadDocsForUser(
  deps: UploadDocsDeps,
): Promise<{ orderId: string; paths: string[] }> {
  const { data: account } = await deps.rls
    .from("accounts")
    .select("id")
    .eq("user_id", deps.userId)
    .maybeSingle();
  if (!account) throw new AppError("Account not found.", "account_missing", 404);

  const { data: orders } = await deps.rls
    .from("orders")
    .select("id")
    .eq("account_id", (account as { id: string }).id)
    .order("created_at", { ascending: false })
    .limit(1);
  const order = (orders as { id: string }[] | null)?.[0];
  if (!order) {
    throw new AppError(
      "Start your order before uploading documents.",
      "order_missing",
      409,
    );
  }

  const { paths } = await storeDocs({
    client: deps.admin,
    orderId: order.id,
    files: deps.files,
  });
  return { orderId: order.id, paths };
}
