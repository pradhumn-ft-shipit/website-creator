/**
 * Round-1 confirm-or-correct + quick questions + Round-2 (PRD §4.1 steps 8, 10,
 * 12 · §8.3 · §5.5). The write-side of ticket 013's intake capture.
 *
 * Split, as elsewhere in the repo, into a PURE core (no IO — the merge + the
 * AUM→registration derivation, both unit-tested in isolation) and thin IO
 * wrappers that read/write through the caller's cookie-bound RLS client. RLS
 * (`owns_order` / `owns_account`) already scopes every row to the signed-in
 * advisor, so unlike the docs path this never needs the service-role client.
 *
 * Storage shape: the corrected Round-1 fields keep the `structured_intake_json`
 * RoundOneIntake shape (a confirmed field is `confidence: 1`, `sources:
 * ['advisor']`). Round-2 answers — which have no place in the extraction schema
 * because they're never inferred — are stored under a `roundTwo` key on the same
 * jsonb blob. AUM/state/CRD are identity-level facts, so they land on `accounts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { AppError } from "@/lib/api/envelope";
import type { Database } from "@/types/database.types";

import { type IntakeField, type RoundOneIntake } from "./schema";

type DbClient = SupabaseClient<Database>;

export interface ConfirmDeps {
  /** Cookie-bound, RLS-scoped client — every write is owner-checked by Postgres. */
  client: DbClient;
  userId: string;
}

// ---- pure core ------------------------------------------------------------

/** The AUM split that drives SEC-vs-state registration (§5.5). */
export type AumBucket = "under_100m" | "over_100m";
export type SubIndustry = "ria_sec" | "ria_state";

export interface SubIndustryResolution {
  subIndustry: SubIndustry;
  /** State-registered firms get the state-overlay disclosure prompts (§5.5). */
  needsStateOverlay: boolean;
}

/**
 * AUM ≥ $100M → SEC-registered (default disclosure set); AUM < $100M →
 * state-registered, which additionally triggers the state-overlay prompts. This
 * is the single source of the §5.5 rule — the UI and the account write both
 * derive from it, so they can never disagree.
 */
export function deriveSubIndustry(bucket: AumBucket): SubIndustryResolution {
  return bucket === "over_100m"
    ? { subIndustry: "ria_sec", needsStateOverlay: false }
    : { subIndustry: "ria_state", needsStateOverlay: true };
}

/** Top-10 states by RIA count — the only ones with a v1 overlay ruleset (§5.5). */
export const STATE_OVERLAYS = ["CA", "NY", "TX", "FL", "IL", "PA", "NJ", "MA", "GA", "OH"] as const;
export type StateCode = (typeof STATE_OVERLAYS)[number];

/** A single confirm-or-correct edit: which field, and the advisor's value. */
export type RoundOneCorrection = { field: keyof RoundOneIntake; value: unknown };

/** An advisor-confirmed field: full confidence, provenance = the advisor. */
function confirmedField<T>(value: T | null): IntakeField<T> {
  return { value, confidence: 1, sources: ["advisor"] };
}

/**
 * Apply confirm-or-correct edits onto the extracted Round-1 blob (pure). Only
 * the listed fields change; each becomes advisor-confirmed (confidence 1). An
 * unknown field key is ignored rather than throwing — the UI only ever emits
 * real keys, and a stray one shouldn't fail the whole save. Non-destructive:
 * returns a new object, never mutates the input (§10.2 spirit).
 */
export function mergeRoundOneCorrections(
  extracted: Partial<RoundOneIntake>,
  corrections: RoundOneCorrection[],
): Partial<RoundOneIntake> {
  const merged: Record<string, unknown> = { ...extracted };
  for (const { field, value } of corrections) {
    if (!VALID_FIELDS.has(field)) continue;
    merged[field] = confirmedField(value as never);
  }
  return merged as Partial<RoundOneIntake>;
}

const VALID_FIELDS = new Set<keyof RoundOneIntake>([
  "firmName",
  "location",
  "yearFounded",
  "teamSize",
  "primaryServices",
  "idealClientPersona",
  "aumRange",
  "custodian",
  "feeStructure",
  "designations",
  "crdNumber",
  "brandColors",
]);

/** Round-2 answers — asked, never inferred (§8.3). All optional (skip-with-default). */
export interface RoundTwoAnswers {
  differentiator?: string;
  servesBest?: string;
  clientStory?: string;
  photosPreference?: "own" | "stock";
  blog?: boolean;
  displayFees?: boolean;
  logoBackground?: "light" | "dark";
  custodianPortalUrl?: string;
  officeAddress?: string;
}

// ---- IO -------------------------------------------------------------------

type IntakeBlob = Partial<RoundOneIntake> & { roundTwo?: RoundTwoAnswers };

/** Resolve the signed-in advisor's account + single order (shared by 013's writes). */
export async function resolveAccountAndOrder(
  client: DbClient,
  userId: string,
): Promise<{ accountId: string; orderId: string }> {
  const { data: account, error: accErr } = await client
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (accErr) throw accErr;
  if (!account) throw new AppError("Account not found.", "account_missing", 404);

  const { data: orders, error: ordErr } = await client
    .from("orders")
    .select("id")
    .eq("account_id", (account as { id: string }).id)
    .order("created_at", { ascending: false })
    .limit(1);
  if (ordErr) throw ordErr;
  const order = (orders as { id: string }[] | null)?.[0];
  if (!order) throw new AppError("Start your order before continuing.", "order_missing", 409);

  return { accountId: (account as { id: string }).id, orderId: order.id };
}

async function readBlob(client: DbClient, orderId: string): Promise<IntakeBlob> {
  const { data, error } = await client
    .from("intake_data")
    .select("structured_intake_json")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) throw error;
  return ((data?.structured_intake_json as IntakeBlob | null) ?? {}) as IntakeBlob;
}

async function writeBlob(client: DbClient, orderId: string, blob: IntakeBlob): Promise<void> {
  const { error } = await client.from("intake_data").upsert(
    {
      order_id: orderId,
      structured_intake_json: blob as Database["public"]["Tables"]["intake_data"]["Insert"]["structured_intake_json"],
    },
    { onConflict: "order_id" },
  );
  if (error) throw error;
}

/** What the confirm UI needs to render: the extracted blob + account identity facts. */
export interface ConfirmView {
  intake: IntakeBlob;
  subIndustry: string | null;
  primaryState: string | null;
  crdNumber: string | null;
  firmName: string | null;
}

/** Read everything the Round-1 confirm screen renders (§4.1.10). */
export async function readIntakeForConfirm(deps: ConfirmDeps): Promise<ConfirmView> {
  const { orderId, accountId } = await resolveAccountAndOrder(deps.client, deps.userId);
  const [blob, account] = await Promise.all([
    readBlob(deps.client, orderId),
    deps.client
      .from("accounts")
      .select("firm_name, sub_industry, primary_state, crd_number")
      .eq("id", accountId)
      .maybeSingle(),
  ]);
  const a = (account.data ?? {}) as {
    firm_name?: string | null;
    sub_industry?: string | null;
    primary_state?: string | null;
    crd_number?: string | null;
  };
  return {
    intake: blob,
    subIndustry: a.sub_industry ?? null,
    primaryState: a.primary_state ?? null,
    crdNumber: a.crd_number ?? null,
    firmName: a.firm_name ?? null,
  };
}

export interface QuickQuestions {
  aumBucket: AumBucket;
  /** Required only on the state-registered (< $100M) branch. */
  primaryState?: string;
  crdNumber?: string;
  custodian?: string;
  designations?: string[];
}

/**
 * Persist the §4.1.8 quick questions. AUM derives `sub_industry` (§5.5) and
 * lands on the account with the state + CRD; custodian/designations, which are
 * also Round-1 fields, are folded into the intake blob as confirmed values.
 */
export async function saveQuickQuestions(
  deps: ConfirmDeps,
  answers: QuickQuestions,
): Promise<{ subIndustry: SubIndustry; needsStateOverlay: boolean }> {
  const { subIndustry, needsStateOverlay } = deriveSubIndustry(answers.aumBucket);
  if (needsStateOverlay && !answers.primaryState) {
    throw new AppError(
      "Pick your primary state of registration.",
      "state_required",
      400,
    );
  }

  const { orderId, accountId } = await resolveAccountAndOrder(deps.client, deps.userId);

  const accountUpdate: Database["public"]["Tables"]["accounts"]["Update"] = {
    sub_industry: subIndustry,
  };
  if (answers.primaryState) accountUpdate.primary_state = answers.primaryState;
  if (answers.crdNumber) accountUpdate.crd_number = answers.crdNumber;
  const { error } = await deps.client.from("accounts").update(accountUpdate).eq("id", accountId);
  if (error) throw error;

  const corrections: RoundOneCorrection[] = [];
  if (answers.custodian) corrections.push({ field: "custodian", value: answers.custodian });
  if (answers.designations) corrections.push({ field: "designations", value: answers.designations });
  if (corrections.length > 0) {
    const blob = await readBlob(deps.client, orderId);
    await writeBlob(deps.client, orderId, mergeRoundOneCorrections(blob, corrections));
  }

  return { subIndustry, needsStateOverlay };
}

/** Persist Round-1 confirm-or-correct edits into the intake blob (§4.1.10). */
export async function saveRoundOneCorrections(
  deps: ConfirmDeps,
  corrections: RoundOneCorrection[],
): Promise<{ status: "saved" }> {
  const { orderId } = await resolveAccountAndOrder(deps.client, deps.userId);
  const blob = await readBlob(deps.client, orderId);
  await writeBlob(deps.client, orderId, mergeRoundOneCorrections(blob, corrections));
  return { status: "saved" };
}

/** Persist Round-2 answers under the intake blob's `roundTwo` key (§4.1.12). */
export async function saveRoundTwo(
  deps: ConfirmDeps,
  answers: RoundTwoAnswers,
): Promise<{ status: "saved" }> {
  const { orderId } = await resolveAccountAndOrder(deps.client, deps.userId);
  const blob = await readBlob(deps.client, orderId);
  await writeBlob(deps.client, orderId, { ...blob, roundTwo: { ...blob.roundTwo, ...answers } });
  return { status: "saved" };
}
