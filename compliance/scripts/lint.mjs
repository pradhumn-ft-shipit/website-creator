// WRI compliance ruleset linter (PRD §5.6) — zero-dependency, pure Node.
//
// Two layers:
//   1. Pure checks (checkRulesJson / checkCitations / checkManifest /
//      checkReviewGate / checkFooter) operate on already-parsed objects and a
//      file-existence predicate. No fs — fully unit-testable.
//   2. IO runners (lintRuleset / lintAll) read a ruleset directory off disk,
//      call the pure checks, and aggregate. fs lives only here, at the edge.
//
// Every check returns a flat array of human-readable, path-qualified error
// strings. A ruleset is valid iff every check returns [].

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SEVERITIES = new Set(["low", "medium", "high"]);
const MATCH_MODES = new Set(["literal", "word", "regex"]);
const PLACEMENTS = new Set(["footer", "page", "form", "prominent"]);

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

// ---------------------------------------------------------------------------
// rules.json
// ---------------------------------------------------------------------------

/** Structural + well-formedness checks for a parsed rules.json object. */
export function checkRulesJson(rules) {
  const errors = [];
  if (!isPlainObject(rules)) {
    return ["rules.json: must be a JSON object"];
  }

  for (const key of ["industry", "version", "status"]) {
    if (!isNonEmptyString(rules[key])) {
      errors.push(`rules.json: "${key}" must be a non-empty string`);
    }
  }

  for (const key of ["prohibited_terms", "required_elements", "required_disclosures", "conditional_rules"]) {
    if (!Array.isArray(rules[key])) {
      errors.push(`rules.json: "${key}" must be an array`);
    }
  }

  if (Array.isArray(rules.prohibited_terms)) {
    rules.prohibited_terms.forEach((t, i) => {
      const at = `rules.json: prohibited_terms[${i}]`;
      if (!isPlainObject(t)) {
        errors.push(`${at} must be an object`);
        return;
      }
      if (!isNonEmptyString(t.id)) errors.push(`${at}.id must be a non-empty string`);
      if (!Array.isArray(t.terms) || t.terms.length === 0 || !t.terms.every(isNonEmptyString)) {
        errors.push(`${at}.terms must be a non-empty array of strings`);
      }
      if (!SEVERITIES.has(t.severity)) {
        errors.push(`${at}.severity must be one of ${[...SEVERITIES].join("|")}`);
      }
      if (!MATCH_MODES.has(t.match)) {
        errors.push(`${at}.match must be one of ${[...MATCH_MODES].join("|")}`);
      }
      if (typeof t.requires_substantiation !== "boolean") {
        errors.push(`${at}.requires_substantiation must be a boolean`);
      }
      if (!isNonEmptyString(t.citation)) {
        errors.push(`${at}.citation must reference a citation id`);
      }
    });
  }

  // required_elements are footer/page links (label required); required_disclosures
  // are text blocks keyed by template/text_pattern (label optional).
  const elementLike = (arr, field, { requireLabel }) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((e, i) => {
      const at = `rules.json: ${field}[${i}]`;
      if (!isPlainObject(e)) {
        errors.push(`${at} must be an object`);
        return;
      }
      if (!isNonEmptyString(e.id)) errors.push(`${at}.id must be a non-empty string`);
      if (requireLabel && !isNonEmptyString(e.label)) {
        errors.push(`${at}.label must be a non-empty string`);
      }
      if (
        !Array.isArray(e.placement) ||
        e.placement.length === 0 ||
        !e.placement.every((p) => PLACEMENTS.has(p))
      ) {
        errors.push(`${at}.placement must be a non-empty array of ${[...PLACEMENTS].join("|")}`);
      }
      if (!isNonEmptyString(e.citation)) {
        errors.push(`${at}.citation must reference a citation id`);
      }
    });
  };
  elementLike(rules.required_elements, "required_elements", { requireLabel: true });
  elementLike(rules.required_disclosures, "required_disclosures", { requireLabel: false });

  if (Array.isArray(rules.required_disclosures)) {
    rules.required_disclosures.forEach((d, i) => {
      if (isPlainObject(d) && !isNonEmptyString(d.template) && !isNonEmptyString(d.text_pattern)) {
        errors.push(
          `rules.json: required_disclosures[${i}] must carry a "template" or "text_pattern"`,
        );
      }
    });
  }

  // prohibited_content: semantic prohibitions (testimonials, unsubstantiated
  // performance claims, endorsements without comp disclosure) — evaluated by
  // Layer 2's LLM rather than literal scan. Optional, but well-formed if present.
  if (rules.prohibited_content !== undefined) {
    if (!Array.isArray(rules.prohibited_content)) {
      errors.push(`rules.json: "prohibited_content" must be an array`);
    } else {
      rules.prohibited_content.forEach((c, i) => {
        const at = `rules.json: prohibited_content[${i}]`;
        if (!isPlainObject(c)) {
          errors.push(`${at} must be an object`);
          return;
        }
        if (!isNonEmptyString(c.id)) errors.push(`${at}.id must be a non-empty string`);
        if (!isNonEmptyString(c.description)) errors.push(`${at}.description must be a non-empty string`);
        if (!SEVERITIES.has(c.severity)) errors.push(`${at}.severity must be one of ${[...SEVERITIES].join("|")}`);
        if (!isNonEmptyString(c.citation)) errors.push(`${at}.citation must reference a citation id`);
      });
    }
  }

  if (Array.isArray(rules.conditional_rules)) {
    rules.conditional_rules.forEach((c, i) => {
      const at = `rules.json: conditional_rules[${i}]`;
      if (!isPlainObject(c)) {
        errors.push(`${at} must be an object`);
        return;
      }
      if (!isNonEmptyString(c.id)) errors.push(`${at}.id must be a non-empty string`);
      if (!isPlainObject(c.when)) errors.push(`${at}.when must be an object`);
      if (!isNonEmptyString(c.citation)) errors.push(`${at}.citation must reference a citation id`);
    });
  }

  if (!isPlainObject(rules.citations)) {
    errors.push(`rules.json: "citations" must be an object mapping id → {title, url}`);
  }

  return errors;
}

/** Every citation id referenced by a rule must resolve in rules.citations. */
export function checkCitations(rules) {
  if (!isPlainObject(rules) || !isPlainObject(rules.citations)) return [];
  const errors = [];
  const known = new Set(Object.keys(rules.citations));

  const referenced = [];
  for (const field of [
    "prohibited_terms",
    "prohibited_content",
    "required_elements",
    "required_disclosures",
    "conditional_rules",
  ]) {
    if (Array.isArray(rules[field])) {
      rules[field].forEach((r, i) => {
        if (isPlainObject(r) && isNonEmptyString(r.citation)) {
          referenced.push({ id: r.citation, where: `${field}[${i}]` });
        }
      });
    }
  }

  for (const ref of referenced) {
    if (!known.has(ref.id)) {
      errors.push(`rules.json: ${ref.where} cites unknown citation "${ref.id}" (not in citations map)`);
    }
  }

  for (const [id, entry] of Object.entries(rules.citations)) {
    if (!isPlainObject(entry) || !isNonEmptyString(entry.title)) {
      errors.push(`rules.json: citations.${id} must have a non-empty "title"`);
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// manifest.json
// ---------------------------------------------------------------------------

/**
 * Validate manifest structure and that every referenced file resolves.
 * `exists(relPath)` is a predicate resolving paths relative to the ruleset dir.
 */
export function checkManifest(manifest, exists) {
  const errors = [];
  if (!isPlainObject(manifest)) return ["manifest.json: must be a JSON object"];

  for (const key of ["industry", "version"]) {
    if (!isNonEmptyString(manifest[key])) {
      errors.push(`manifest.json: "${key}" must be a non-empty string`);
    }
  }

  const artifacts = manifest.artifacts;
  if (!isPlainObject(artifacts)) {
    errors.push(`manifest.json: "artifacts" must be an object`);
  } else {
    for (const key of ["rules_machine", "rules_human", "disclosures_dir"]) {
      if (!isNonEmptyString(artifacts[key])) {
        errors.push(`manifest.json: artifacts.${key} must be a non-empty string`);
      } else if (!exists(artifacts[key])) {
        errors.push(`manifest.json: artifacts.${key} → "${artifacts[key]}" does not exist`);
      }
    }
  }

  if (manifest.state_overlays !== undefined) {
    if (!Array.isArray(manifest.state_overlays)) {
      errors.push(`manifest.json: "state_overlays" must be an array`);
    } else {
      manifest.state_overlays.forEach((o, i) => {
        const at = `manifest.json: state_overlays[${i}]`;
        if (!isPlainObject(o) || !isNonEmptyString(o.state) || !isNonEmptyString(o.file)) {
          errors.push(`${at} must be {state, file}`);
        } else if (!exists(o.file)) {
          errors.push(`${at}.file → "${o.file}" does not exist`);
        }
      });
    }
  }

  if (!isPlainObject(manifest.review)) {
    errors.push(`manifest.json: "review" must be an object`);
  }

  return errors;
}

/**
 * Publish guard (PRD §5.7): a ruleset may only be `approved` after two-person
 * review. If approved, it must name ≥2 reviewers and record who/when published.
 */
export function checkReviewGate(manifest) {
  if (!isPlainObject(manifest) || !isPlainObject(manifest.review)) return [];
  const review = manifest.review;
  if (review.approved !== true) return [];

  const errors = [];
  const reviewers = Array.isArray(review.reviewers) ? review.reviewers : [];
  if (reviewers.length < 2) {
    errors.push(
      `manifest.json: review.approved=true requires ≥2 reviewers (PRD §5.7), found ${reviewers.length}`,
    );
  }
  if (!isNonEmptyString(manifest.published_at)) {
    errors.push(`manifest.json: an approved ruleset must record "published_at"`);
  }
  if (!isNonEmptyString(manifest.published_by)) {
    errors.push(`manifest.json: an approved ruleset must record "published_by"`);
  }
  return errors;
}

// ---------------------------------------------------------------------------
// footer-standard.md
// ---------------------------------------------------------------------------

/** The §18.2 footer template must carry these markers/placeholders. */
const FOOTER_MARKERS = [
  { id: "firm_name", pattern: /\{\{\s*firm_name\s*\}\}/i, label: "{{firm_name}} placeholder" },
  {
    id: "registration_status",
    pattern: /\{\{\s*registration_status\s*\}\}/i,
    label: "{{registration_status}} placeholder",
  },
  {
    id: "no_skill_disclaimer",
    pattern: /registration does not imply/i,
    label: '"Registration does not imply..." disclaimer',
  },
  {
    id: "informational_only",
    pattern: /informational purposes only/i,
    label: '"informational purposes only" disclaimer',
  },
  { id: "adv_2a", pattern: /ADV Part 2A/i, label: "Form ADV Part 2A link" },
  { id: "adv_2b", pattern: /ADV Part 2B/i, label: "Form ADV Part 2B link" },
  { id: "crs", pattern: /Form CRS/i, label: "Form CRS link" },
  { id: "privacy", pattern: /Privacy Policy/i, label: "Privacy Policy link" },
];

export function checkFooter(text) {
  if (typeof text !== "string") return ["footer-standard.md: missing or unreadable"];
  const errors = [];
  for (const marker of FOOTER_MARKERS) {
    if (!marker.pattern.test(text)) {
      errors.push(`footer-standard.md: missing ${marker.label} (§18.2)`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// IO runners
// ---------------------------------------------------------------------------

function readJsonIfPresent(path) {
  if (!existsSync(path)) return { missing: true };
  try {
    return { value: JSON.parse(readFileSync(path, "utf8")) };
  } catch (err) {
    return { parseError: err.message };
  }
}

/** Lint a single versioned ruleset directory. Returns {ok, errors}. */
export function lintRuleset(dir) {
  const errors = [];
  const exists = (rel) => existsSync(join(dir, rel));

  const rulesRes = readJsonIfPresent(join(dir, "rules.json"));
  if (rulesRes.missing) errors.push("rules.json: file not found");
  else if (rulesRes.parseError) errors.push(`rules.json: invalid JSON — ${rulesRes.parseError}`);
  else errors.push(...checkRulesJson(rulesRes.value), ...checkCitations(rulesRes.value));

  const manifestRes = readJsonIfPresent(join(dir, "manifest.json"));
  if (manifestRes.missing) errors.push("manifest.json: file not found");
  else if (manifestRes.parseError) errors.push(`manifest.json: invalid JSON — ${manifestRes.parseError}`);
  else errors.push(...checkManifest(manifestRes.value, exists), ...checkReviewGate(manifestRes.value));

  if (!exists("rules.md")) {
    errors.push("rules.md: file not found");
  }

  const footerPath = join(dir, "disclosures", "footer-standard.md");
  const footerText = existsSync(footerPath) ? readFileSync(footerPath, "utf8") : undefined;
  errors.push(...checkFooter(footerText));

  return { ok: errors.length === 0, errors };
}

/** Discover and lint every versioned ruleset (industry/vN.N) under root. */
export function lintAll(root) {
  const results = [];
  for (const industry of safeDirs(root)) {
    const industryDir = join(root, industry);
    for (const version of safeDirs(industryDir)) {
      if (!version.startsWith("v")) continue;
      const dir = join(industryDir, version);
      if (!existsSync(join(dir, "manifest.json"))) continue;
      results.push({ dir: `${industry}/${version}`, ...lintRuleset(dir) });
    }
  }
  return { ok: results.every((r) => r.ok), results };
}

function safeDirs(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("__") && !d.name.startsWith("."))
    .map((d) => d.name);
}

export function formatReport(results) {
  const lines = [];
  for (const r of results) {
    if (r.ok) {
      lines.push(`  ✓ ${r.dir}`);
    } else {
      lines.push(`  ✗ ${r.dir} — ${r.errors.length} error(s):`);
      for (const e of r.errors) lines.push(`      • ${e}`);
    }
  }
  return lines.join("\n");
}
