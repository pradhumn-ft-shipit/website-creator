/**
 * Template selection + build hand-off (PRD §4.1.9/§4.1.14 · §6.1). The last
 * screen of the intake flow: pick Trust / Modern / Boutique, then kick the
 * generation pipeline.
 *
 * §6.1 differentiates on aesthetic + information density, not layout. The
 * catalog here is the single source the picker renders from (description +
 * persona + preview hints) — the actual Astro templates live under
 * `templates/{trust|modern|boutique}` (016/018). Each preview is tinted with the
 * brand colour extracted in 012 (`previewAccentDefault` is the fallback when
 * none was found).
 *
 * Build trigger: per the 013 flow decision the `order.created` enqueue moved
 * OFF payment (010's checkout now only creates the order) and fires here, from
 * "Build my site", after the advisor has confirmed everything. (When 020 lands,
 * copy review slots in ahead of this and the enqueue moves to its final
 * approval — §4.1 step 14; until then this is the flow's build entry point.)
 */
import { AppError } from "@/lib/api/envelope";

import { resolveAccountAndOrder, type ConfirmDeps } from "./confirm";

export type TemplateId = "trust" | "modern" | "boutique";
export const TEMPLATE_IDS: readonly TemplateId[] = ["trust", "modern", "boutique"];

export interface TemplateSpec {
  id: TemplateId;
  name: string;
  aesthetic: string;
  persona: string;
  /** Preview hints for the picker cards (§6.1). */
  headingStyle: "serif" | "sans" | "mixed";
  /** Fallback preview accent when no brand colour was extracted (012). */
  previewAccentDefault: string;
}

/** The §6.1 three-template catalog — descriptions + personas, verbatim intent. */
export const TEMPLATE_CATALOG: readonly TemplateSpec[] = [
  {
    id: "trust",
    name: "Trust",
    aesthetic: "Serif headings, navy/charcoal palette, advisor-photo hero, credentials-heavy, long-form About.",
    persona: "Older, conservative advisors; legacy practices.",
    headingStyle: "serif",
    previewAccentDefault: "#2B3A4D",
  },
  {
    id: "modern",
    name: "Modern",
    aesthetic: "Sans-serif, generous whitespace, big imagery, short copy blocks, gradient or muted accent.",
    persona: "Gen X / NextGen-focused advisors.",
    headingStyle: "sans",
    previewAccentDefault: "#1F6F52",
  },
  {
    id: "boutique",
    name: "Boutique",
    aesthetic: "Magazine-style, mixed serif/sans, photography-forward, thought-leadership / blog-prominent.",
    persona: "Content-producing advisors, RIAs targeting professionals.",
    headingStyle: "mixed",
    previewAccentDefault: "#7A4BD0",
  },
];

/** Guard an untrusted template id against the closed set (also the DB check). */
export function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === "string" && (TEMPLATE_IDS as readonly string[]).includes(value);
}

// ---- IO -------------------------------------------------------------------

/**
 * Persist the chosen template to the account's single site (v1: one site per
 * account). Upserts by account — updates the existing row's `template_id` or
 * inserts the first site — so re-picking before build never creates a second
 * site. Selection is locked after build (§3.2, enforced by 029 later).
 */
export async function selectTemplate(
  deps: ConfirmDeps,
  templateId: TemplateId,
): Promise<{ templateId: TemplateId; created: boolean }> {
  if (!isTemplateId(templateId)) {
    throw new AppError("Pick one of the three templates.", "invalid_template", 400);
  }
  const { accountId } = await resolveAccountAndOrder(deps.client, deps.userId);

  const { data: existing, error: readErr } = await deps.client
    .from("sites")
    .select("id")
    .eq("account_id", accountId)
    .maybeSingle();
  if (readErr) throw readErr;

  if (existing) {
    const { error } = await deps.client
      .from("sites")
      .update({ template_id: templateId })
      .eq("id", (existing as { id: string }).id);
    if (error) throw error;
    return { templateId, created: false };
  }

  const { error } = await deps.client
    .from("sites")
    .insert({ account_id: accountId, template_id: templateId });
  if (error) throw error;
  return { templateId, created: true };
}

/** Minimal Inngest sender contract — satisfied by `inngest.send`. */
export type BuildEventSender = (event: {
  name: "order.created";
  data: { orderId: string; accountId: string };
}) => Promise<unknown>;

export interface BuildDeps extends ConfirmDeps {
  send: BuildEventSender;
}

/**
 * "Build my site" (§4.1.14). Requires a template to be chosen first, then emits
 * `order.created` so the pipeline (009) runs. Returns the order it kicked.
 */
export async function finalizeAndBuild(deps: BuildDeps): Promise<{ orderId: string }> {
  const { accountId, orderId } = await resolveAccountAndOrder(deps.client, deps.userId);

  const { data: site, error } = await deps.client
    .from("sites")
    .select("template_id")
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) throw error;
  if (!site || !(site as { template_id: string | null }).template_id) {
    throw new AppError("Choose a template before building your site.", "template_required", 409);
  }

  await deps.send({ name: "order.created", data: { orderId, accountId } });
  return { orderId };
}
