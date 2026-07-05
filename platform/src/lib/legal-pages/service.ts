/**
 * Generated-site legal-pages step (PRD §14.1, §6.9, §9.2).
 *
 * Reads the advisor's account (firm, registration, state), builds the Privacy
 * Policy / Terms of Service / 404 copy deterministically, runs each legal
 * document through the Layer-2 validator (build-loop step 6 — legal copy must be
 * clean of prohibited terms), and persists every page as a `generated_content`
 * row the build step (024) consumes. Privacy + Terms are recorded as required,
 * non-removable pages (§4.4).
 *
 * The account read + `generated_content` writes are IO, deferred behind live
 * Supabase (no Docker), same posture as 012/033. The pure shaping
 * (`legalContextFromAccount`) + the copy + the Layer-2 pass are fully tested.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import {
  runLayer2,
  type Layer2Gemini,
  type Layer2Result,
} from "@/lib/compliance";

import {
  buildLegalPages,
  type LegalPage,
  type LegalPageContext,
} from "./templates";

type AdminClient = SupabaseClient<Database>;

/** The generated_content "section" legal pages are filed under. */
export const LEGAL_SECTION = "legal";

interface AccountLike {
  firm_name: string | null;
  sub_industry: string | null;
  primary_state: string | null;
  industry: string;
}

/** Derive the legal-copy context from an account row. */
export function legalContextFromAccount(account: AccountLike): LegalPageContext {
  return {
    firmName: account.firm_name?.trim() || "Our Firm",
    registration: account.sub_industry === "ria_state" ? "state" : "sec",
    state: account.primary_state ?? null,
    industry: "ria",
  };
}

export interface LegalPageValidation {
  slug: LegalPage["slug"];
  result: Layer2Result;
}

export interface LegalPagesResult {
  pages: LegalPage[];
  validations: LegalPageValidation[];
}

export interface GenerateLegalPagesDeps {
  client: AdminClient;
  orderId: string;
  accountId: string;
  /** Optional Gemini client to also run the Layer-2 AI pass; omit → deterministic. */
  gemini?: Layer2Gemini;
  /** Ruleset dir override (tests); defaults to the active RIA ruleset on disk. */
  rulesetDir?: string;
}

async function readAccount(
  client: AdminClient,
  accountId: string,
): Promise<AccountLike> {
  const { data } = await client
    .from("accounts")
    .select("firm_name, sub_industry, primary_state, industry")
    .eq("id", accountId)
    .maybeSingle();
  return (
    (data as AccountLike | null) ?? {
      firm_name: null,
      sub_industry: null,
      primary_state: null,
      industry: "ria",
    }
  );
}

/** Validate each legal *document* (the 404 is copy, not a compliance subject). */
export async function validateLegalPages(
  pages: LegalPage[],
  ctx: LegalPageContext,
  opts: { gemini?: Layer2Gemini; rulesetDir?: string } = {},
): Promise<LegalPageValidation[]> {
  const validations: LegalPageValidation[] = [];
  for (const page of pages) {
    if (page.content.kind !== "document") continue;
    const result = await runLayer2({
      subject: { kind: "fragment", text: page.bodyMarkdown, label: page.slug },
      registration: ctx.registration,
      primaryState: ctx.state,
      gemini: opts.gemini,
      dir: opts.rulesetDir,
    });
    validations.push({ slug: page.slug, result });
  }
  return validations;
}

async function nextVersion(
  client: AdminClient,
  orderId: string,
  page: string,
): Promise<number> {
  const { data } = await client
    .from("generated_content")
    .select("version")
    .eq("order_id", orderId)
    .eq("page", page)
    .order("version", { ascending: false })
    .limit(1);
  const rows = data as { version: number }[] | null;
  return (rows?.[0]?.version ?? 0) + 1;
}

/**
 * Generate, validate, and persist the site's legal + hygiene pages. Returns the
 * pages + their Layer-2 verdicts so the caller (pipeline / admin) can surface a
 * failed page rather than silently ship it.
 */
export async function generateLegalPages(
  deps: GenerateLegalPagesDeps,
): Promise<LegalPagesResult> {
  const account = await readAccount(deps.client, deps.accountId);
  const ctx = legalContextFromAccount(account);
  const pages = buildLegalPages(ctx);

  const validations = await validateLegalPages(pages, ctx, {
    gemini: deps.gemini,
    rulesetDir: deps.rulesetDir,
  });

  for (const page of pages) {
    const version = await nextVersion(deps.client, deps.orderId, page.slug);
    await deps.client.from("generated_content").insert({
      order_id: deps.orderId,
      version,
      page: page.slug,
      section: LEGAL_SECTION,
      compliance_version_used:
        validations.find((v) => v.slug === page.slug)?.result.rulesetVersion ??
        null,
      content_json: {
        title: page.title,
        required: page.required,
        removable: page.removable,
        bodyMarkdown: page.bodyMarkdown,
        content: page.content,
      } as unknown as Database["public"]["Tables"]["generated_content"]["Insert"]["content_json"],
    });
  }

  return { pages, validations };
}
