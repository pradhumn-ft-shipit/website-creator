// Section-removal engine (PRD §6.3). Core principle: NO EMPTY SECTIONS.
// If generation could not populate a section meaningfully, that section is dropped from
// the build and navigation auto-adjusts. This module computes the single "presence" map
// that both the nav derivation (sitemap.mjs) and every page template read from — so the
// removal rule is decided in ONE place, never re-derived per template.

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const nonEmptyArray = (v) => Array.isArray(v) && v.length > 0;
const nonEmptyStr = (v) => typeof v === 'string' && v.trim().length > 0;

/**
 * Is a single removable section populated enough to render?
 * Exposed so templates/tests can ask about one section, but `resolveSite` is the
 * normal entry point.
 */
export function isSectionPopulated(key, content) {
  switch (key) {
    case 'services':
      // Services page removed entirely if no services offered (§6.3).
      return nonEmptyArray(content.services);
    case 'process':
      return isObject(content.process) && nonEmptyArray(content.process.steps);
    case 'whoWeServe':
      return isObject(content.whoWeServe) && nonEmptyArray(content.whoWeServe.personas);
    case 'insights':
      // Hidden unless blog explicitly enabled AND has content (§6.2/§6.3).
      return isObject(content.insights) && content.insights.enabled === true;
    case 'fees':
      return isObject(content.fees) && (nonEmptyStr(content.fees.body) || nonEmptyArray(content.fees.tiers));
    case 'clientLogin':
      // Shown only if a custodian portal URL was provided (§6.2).
      return isObject(content.firm) && nonEmptyStr(content.firm.custodianLoginUrl);
    default:
      return false;
  }
}

/**
 * Does the firm have a real team (more than the single principal)?
 * Solo firms hide the team grid and show a single principal bio inline on About (§6.3).
 */
export function hasTeam(content) {
  return isObject(content.about) && nonEmptyArray(content.about.team);
}

/**
 * Resolve a raw content object into a render plan:
 *   - `presence`: which pages/sections exist (Home/About/Contact always true)
 *   - `isSolo`:   true when the team grid should collapse to a single bio
 *   - `firm`,`content`: passthrough for convenience
 *
 * This is the authoritative "what actually gets built" object. Nav + pages both read it,
 * so a section can never appear in nav but be empty on its page (or vice-versa).
 */
export function resolveSite(content) {
  if (!isObject(content)) throw new TypeError('resolveSite expects a content object');

  const presence = {
    home: true, // always present (§6.2)
    about: true, // always present (§6.2)
    contact: true, // always present (§6.2)
    services: isSectionPopulated('services', content),
    process: isSectionPopulated('process', content),
    whoWeServe: isSectionPopulated('whoWeServe', content),
    insights: isSectionPopulated('insights', content),
    fees: isSectionPopulated('fees', content),
    clientLogin: isSectionPopulated('clientLogin', content),
  };

  return {
    presence,
    isSolo: !hasTeam(content),
    content,
  };
}
