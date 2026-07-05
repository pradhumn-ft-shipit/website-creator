/**
 * Ruleset diff engine (PRD §5.7 / §11.2 diff viewer) — pure, no IO.
 *
 * Compares two parsed `Ruleset`s (from `lib/compliance/ruleset`) rule-by-rule
 * within each category, keyed by the rule `id`, and reports what was added,
 * removed, or changed. The admin diff viewer renders the result; the publish
 * flow uses `diffTotals` to show a reviewer the size of the change before they
 * sign off.
 *
 * Depth: the whole comparison — per-category keying, deep-equality on rule
 * bodies, human labels — lives behind `diffRulesets`. Callers pass two rulesets
 * and get one structured, presentational diff.
 */

import type { Ruleset } from "@/lib/compliance";

export type ChangeKind = "added" | "removed" | "changed";

/** One rule-level change within a category. */
export interface RuleChange {
  /** The rule `id` (or citation key) this change concerns. */
  id: string;
  kind: ChangeKind;
  /** A short human label (the rule's description/label/term list) for display. */
  label: string;
  /** The rule body before (null when added). */
  before: unknown | null;
  /** The rule body after (null when removed). */
  after: unknown | null;
}

/** The categories we diff, in display order. */
export const DIFF_CATEGORIES = [
  "prohibitedTerms",
  "prohibitedContent",
  "requiredElements",
  "requiredDisclosures",
  "conditionalRules",
  "citations",
] as const;

export type DiffCategory = (typeof DIFF_CATEGORIES)[number];

export interface RulesetDiff {
  /** Changes per category (empty array when a category is unchanged). */
  categories: Record<DiffCategory, RuleChange[]>;
  totals: { added: number; removed: number; changed: number };
  /** True when nothing differs — the two versions are identical. */
  identical: boolean;
}

type Keyed = { id: string; [k: string]: unknown };

function labelFor(category: DiffCategory, rule: Record<string, unknown>): string {
  if (category === "prohibitedTerms" && Array.isArray(rule.terms)) {
    return (rule.terms as string[]).join(", ");
  }
  const label = rule.label ?? rule.description ?? rule.title ?? rule.id;
  return typeof label === "string" ? label : String(rule.id ?? "");
}

/** Deep structural equality via canonical JSON (rules are plain data). */
function equal(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Diff one keyed-by-id category (arrays of {id,...} or the citations map). */
function diffCategory(
  category: DiffCategory,
  before: Record<string, unknown>[],
  after: Record<string, unknown>[],
): RuleChange[] {
  const beforeById = new Map(before.map((r) => [String(r.id), r]));
  const afterById = new Map(after.map((r) => [String(r.id), r]));
  const changes: RuleChange[] = [];

  for (const [id, rule] of beforeById) {
    if (!afterById.has(id)) {
      changes.push({ id, kind: "removed", label: labelFor(category, rule), before: rule, after: null });
    }
  }
  for (const [id, rule] of afterById) {
    const prior = beforeById.get(id);
    if (!prior) {
      changes.push({ id, kind: "added", label: labelFor(category, rule), before: null, after: rule });
    } else if (!equal(prior, rule)) {
      changes.push({ id, kind: "changed", label: labelFor(category, rule), before: prior, after: rule });
    }
  }
  // Stable order: added, then changed, then removed, each alphabetical by id.
  const rank: Record<ChangeKind, number> = { added: 0, changed: 1, removed: 2 };
  return changes.sort((a, b) => rank[a.kind] - rank[b.kind] || a.id.localeCompare(b.id));
}

/** Citations are a `Record<id,{title,url}>` — normalize to the keyed-array shape. */
function citationsToArray(rules: Ruleset): Record<string, unknown>[] {
  return Object.entries(rules.citations).map(([id, c]) => ({ id, ...c }));
}

/** Compute a structured, presentational diff between two rulesets. */
export function diffRulesets(before: Ruleset, after: Ruleset): RulesetDiff {
  const source: Record<DiffCategory, [Keyed[], Keyed[]]> = {
    prohibitedTerms: [before.prohibitedTerms as unknown as Keyed[], after.prohibitedTerms as unknown as Keyed[]],
    prohibitedContent: [before.prohibitedContent as unknown as Keyed[], after.prohibitedContent as unknown as Keyed[]],
    requiredElements: [before.requiredElements as unknown as Keyed[], after.requiredElements as unknown as Keyed[]],
    requiredDisclosures: [before.requiredDisclosures as unknown as Keyed[], after.requiredDisclosures as unknown as Keyed[]],
    conditionalRules: [before.conditionalRules as unknown as Keyed[], after.conditionalRules as unknown as Keyed[]],
    citations: [citationsToArray(before) as Keyed[], citationsToArray(after) as Keyed[]],
  };

  const categories = {} as Record<DiffCategory, RuleChange[]>;
  const totals = { added: 0, removed: 0, changed: 0 };
  for (const category of DIFF_CATEGORIES) {
    const [b, a] = source[category];
    const changes = diffCategory(category, b, a);
    categories[category] = changes;
    for (const c of changes) totals[c.kind] += 1;
  }

  const identical = totals.added + totals.removed + totals.changed === 0;
  return { categories, totals, identical };
}
