/**
 * Onboarding IO (PRD §4.1 steps 4–6). The single place the onboarding flow
 * talks to Supabase + Inngest. Every write is scoped to the signed-in advisor's
 * own `accounts` row and their single order (RLS enforces `owns_account`; the
 * explicit `.eq("user_id", …)` narrows to that one row).
 *
 * Progress is persisted onto the account itself (decision 2026-06-05): the
 * industry/sub-class answers ARE the resumable state, so there's no separate
 * progress table. `getOnboardingState` reads those fields + whether an order
 * exists; `steps.resolveResumeStep` turns that into the step to render.
 *
 * Deps (client + userId + send) are injected so the routes pass the cookie-bound
 * server client and the real Inngest sender while tests pass stubs — the same
 * pattern as `lib/admin/orders.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { AppError } from "@/lib/api/envelope";
import { inngest } from "@/lib/inngest/client";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import { isLiveIndustry, validateSubClass } from "./steps";

type DbClient = SupabaseClient<Database>;

/** Minimal sender contract — satisfied by the real Inngest client (`inngest.send`). */
type OrderEventSender = (event: {
  name: "order.created";
  data: { orderId: string; accountId: string };
}) => Promise<unknown>;

export type OnboardingDeps = {
  client: DbClient;
  userId: string;
  send?: OrderEventSender;
};

/**
 * Build the production deps from the request context: the cookie-bound server
 * client (RLS-scoped to the signed-in advisor) + the real Inngest sender. Throws
 * 401 if the session vanished between the middleware guard and the call. Routes
 * call this, then hand the deps to the functions below; tests skip it and inject
 * stubs directly.
 */
export async function resolveOnboardingDeps(): Promise<OnboardingDeps> {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new AppError("Please sign in to continue.", "unauthenticated", 401);
  return {
    client: client as unknown as DbClient,
    userId: user.id,
    send: (event) => inngest.send(event),
  };
}

type AccountSelectionRow = {
  id: string;
  industry: string | null;
  sub_industry: string | null;
};

/** Read the signed-in advisor's account row (id + onboarding selections). */
async function readAccount(deps: OnboardingDeps): Promise<AccountSelectionRow> {
  const { data, error } = await deps.client
    .from("accounts")
    .select("id, industry, sub_industry")
    .eq("user_id", deps.userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError("Account not found.", "account_missing", 404);
  return data as AccountSelectionRow;
}

/** Latest order for the account, if any (v1 = one website, so at most one). */
async function readLatestOrder(
  deps: OnboardingDeps,
  accountId: string,
): Promise<{ id: string; status: string } | null> {
  const { data, error } = await deps.client
    .from("orders")
    .select("id, status")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const rows = (data ?? []) as { id: string; status: string }[];
  return rows[0] ?? null;
}

export type SelectionPatch = { industry?: string; subIndustry?: string };

/**
 * Persist an onboarding answer (§7.7 auto-save). Validates the field before the
 * write so an out-of-scope industry (non-RIA → waitlist) or sub-class never
 * lands on the account. Each step calls this before advancing, which is what
 * makes the flow resumable.
 */
export async function saveOnboardingSelection(
  deps: OnboardingDeps,
  patch: SelectionPatch,
): Promise<{ status: "saved" }> {
  const update: Database["public"]["Tables"]["accounts"]["Update"] = {};

  if (patch.industry !== undefined) {
    if (!isLiveIndustry(patch.industry)) {
      throw new AppError(
        "That industry isn't available yet — join the waitlist instead.",
        "industry_unavailable",
        400,
      );
    }
    update.industry = patch.industry;
  }

  if (patch.subIndustry !== undefined) {
    const invalid = validateSubClass(patch.subIndustry);
    if (invalid) throw new AppError(invalid, "invalid_sub_class", 400);
    update.sub_industry = patch.subIndustry;
  }

  if (Object.keys(update).length === 0) {
    throw new AppError("Nothing to save.", "empty_selection", 400);
  }

  const { error } = await deps.client
    .from("accounts")
    .update(update)
    .eq("user_id", deps.userId);
  if (error) throw error;
  return { status: "saved" };
}

/**
 * The simulated-checkout success handler (§15.4 — payment is a placeholder in
 * alpha). Creates the advisor's single order at the pipeline entry state.
 * Idempotent on double-submit: if an order already exists we return it without
 * inserting a second (v1 is one website per account).
 *
 * NB (013 flow decision): checkout NO LONGER emits `order.created`. The build
 * enqueue moved to the end of the intake flow ("Build my site", after template
 * selection) — see `lib/intake/templates.ts#finalizeAndBuild`. Creating the
 * order here still lets the intake screens attach `intake_data` to it while the
 * advisor works; the pipeline only starts once they finalize.
 */
export async function createOrder(
  deps: OnboardingDeps,
): Promise<{ orderId: string; created: boolean }> {
  const account = await readAccount(deps);

  if (!isLiveIndustry(account.industry ?? "") || validateSubClass(account.sub_industry ?? "")) {
    throw new AppError(
      "Choose your industry and practice type before continuing.",
      "onboarding_incomplete",
      400,
    );
  }

  const existing = await readLatestOrder(deps, account.id);
  if (existing) return { orderId: existing.id, created: false };

  const { data, error } = await deps.client
    .from("orders")
    .insert({ account_id: account.id, status: "payment_received", state_machine_position: "0" })
    .select("id")
    .single();
  if (error) throw error;

  return { orderId: (data as { id: string }).id, created: true };
}

export type OnboardingState = {
  industry: string | null;
  subIndustry: string | null;
  hasOrder: boolean;
  orderId: string | null;
  orderStatus: string | null;
};

/** Resume signals for the server page: selections + whether the pipeline started. */
export async function getOnboardingState(
  deps: OnboardingDeps,
): Promise<OnboardingState> {
  const account = await readAccount(deps);
  const order = await readLatestOrder(deps, account.id);
  return {
    industry: account.industry,
    subIndustry: account.sub_industry,
    hasOrder: order !== null,
    orderId: order?.id ?? null,
    orderStatus: order?.status ?? null,
  };
}
