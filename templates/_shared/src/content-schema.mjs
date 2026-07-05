// WRI shared content schema — the versioned JSON contract that generation (ticket 020)
// produces and every template consumes. All three templates (Trust/Modern/Boutique)
// render the SAME shape; they differ only in styling/typography/composition (PRD §6.1).
//
// This module is the single source of truth for the shape + a fail-loud validator.
// The JSON-Schema mirror lives beside it in `content.schema.json` (the editor/contract
// artifact 020 targets); THIS validator is authoritative for build-time gating.
//
// Versioning: bump SITE_CONTENT_SCHEMA_VERSION on any breaking shape change. Every
// generated content object records the version it was produced against.

export const SITE_CONTENT_SCHEMA_VERSION = 'site.v1';

/** Sections that can be conditionally removed (PRD §6.3). Home/About/Contact are never removable. */
export const REMOVABLE_SECTIONS = Object.freeze([
  'services',
  'process',
  'whoWeServe',
  'insights',
  'fees',
  'clientLogin',
]);

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isArray = Array.isArray;

/**
 * Validate a content object against the schema contract.
 * Returns `{ ok, errors }` — errors are path-qualified strings (never throws on bad input;
 * throws only on a caller passing a non-object, which is a programming error).
 *
 * Validates STRUCTURE + required fields only. Content-property checks (prohibited terms,
 * CRS presence) are the compliance layer's job (006), deliberately not duplicated here.
 */
export function validateContent(content) {
  if (!isObject(content)) {
    throw new TypeError('validateContent expects an object');
  }
  const errors = [];
  const err = (path, msg) => errors.push(`${path}: ${msg}`);

  // --- version ---
  if (content.schemaVersion !== SITE_CONTENT_SCHEMA_VERSION) {
    err('schemaVersion', `must equal "${SITE_CONTENT_SCHEMA_VERSION}" (got ${JSON.stringify(content.schemaVersion)})`);
  }

  // --- firm (required) ---
  const firm = content.firm;
  if (!isObject(firm)) {
    err('firm', 'required object');
  } else {
    if (!isNonEmptyString(firm.name)) err('firm.name', 'required non-empty string');
    if (firm.registration !== 'sec' && firm.registration !== 'state') {
      err('firm.registration', 'must be "sec" or "state"');
    }
    if (firm.registration === 'state' && !isNonEmptyString(firm.state)) {
      err('firm.state', 'required when registration is "state" (drives footer state overlay)');
    }
    if (firm.custodianLoginUrl !== undefined && !isNonEmptyString(firm.custodianLoginUrl)) {
      err('firm.custodianLoginUrl', 'must be a non-empty string when present');
    }
  }

  // --- home (required) ---
  const home = content.home;
  if (!isObject(home)) {
    err('home', 'required object');
  } else if (!isObject(home.hero)) {
    err('home.hero', 'required object');
  } else {
    if (!isNonEmptyString(home.hero.heading)) err('home.hero.heading', 'required non-empty string');
  }

  // --- about (required) ---
  const about = content.about;
  if (!isObject(about)) {
    err('about', 'required object');
  } else {
    if (!isNonEmptyString(about.headline)) err('about.headline', 'required non-empty string');
    if (!isNonEmptyString(about.body)) err('about.body', 'required non-empty string');
    if (about.principal !== undefined && !isObject(about.principal)) {
      err('about.principal', 'must be an object when present');
    }
    if (about.team !== undefined && !isArray(about.team)) {
      err('about.team', 'must be an array when present');
    }
  }

  // --- contact (required) ---
  const contact = content.contact;
  if (!isObject(contact)) {
    err('contact', 'required object');
  } else if (!isNonEmptyString(contact.headline)) {
    err('contact.headline', 'required non-empty string');
  }

  // --- optional/removable sections: validate shape only when present ---
  if (content.services !== undefined && !isArray(content.services)) {
    err('services', 'must be an array when present');
  }
  if (isArray(content.services)) {
    content.services.forEach((s, i) => {
      if (!isObject(s) || !isNonEmptyString(s.title)) err(`services[${i}].title`, 'required non-empty string');
    });
  }
  if (content.process !== undefined && !isObject(content.process)) {
    err('process', 'must be an object when present');
  }
  if (content.whoWeServe !== undefined && !isObject(content.whoWeServe)) {
    err('whoWeServe', 'must be an object when present');
  }
  if (content.insights !== undefined && !isObject(content.insights)) {
    err('insights', 'must be an object when present');
  }
  if (content.fees !== undefined && !isObject(content.fees)) {
    err('fees', 'must be an object when present');
  }
  if (content.brand !== undefined && !isObject(content.brand)) {
    err('brand', 'must be an object when present');
  }

  return { ok: errors.length === 0, errors };
}
