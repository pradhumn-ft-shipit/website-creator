// Ruleset-driven compliance footer (PRD §5.3, §18.2). The footer is the compliance moat's
// most visible surface: it renders on EVERY page and its content is driven by the authored
// RIA ruleset (ticket 005), never hardcoded in a template. This module reads the ruleset
// artifacts off disk and returns a STRUCTURED footer model; each template styles that model
// its own way but can never omit a required disclosure or the ADV/CRS/Privacy links.
//
// Wiring note: at real build time (ticket 024) the resolved-ruleset object comes from the
// 006 loader (which also applies the state overlay). Here we read the same on-disk artifacts
// directly so the template is provably ruleset-driven standalone.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_COMPLIANCE_DIR = join(__dirname, '..', '..', '..', 'compliance');

const hasPlacement = (item, where) => Array.isArray(item.placement) && item.placement.includes(where);

/** Extract the first blockquote body under a "Footer registration line" heading in a state overlay. */
function parseOverlayRegistrationLine(md) {
  const lines = md.split('\n');
  let inSection = false;
  const quote = [];
  for (const line of lines) {
    if (/^##\s+Footer registration line/i.test(line)) { inSection = true; continue; }
    if (inSection && /^##\s+/.test(line)) break;
    if (inSection && line.startsWith('>')) quote.push(line.replace(/^>\s?/, '').trim());
    else if (inSection && quote.length && line.trim() === '') break;
  }
  return quote.join(' ').trim() || null;
}

function fill(template, vars) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''));
}

/**
 * Build the footer model for a site.
 *
 * @param {object} args
 * @param {object} args.content        the site content object (firm + assets)
 * @param {string} [args.industry]     ruleset industry (default "ria")
 * @param {string} [args.version]      ruleset version (default "v1.0")
 * @param {string} [args.complianceDir] override the compliance artifacts root (tests)
 *
 * @returns {{ registrationLine, disclosures: string[], links: {label,href,missing}[], rulesetVersion }}
 */
export function buildFooter({ content, industry = 'ria', version = 'v1.0', complianceDir = DEFAULT_COMPLIANCE_DIR }) {
  const dir = join(complianceDir, industry, version);
  const rules = JSON.parse(readFileSync(join(dir, 'rules.json'), 'utf8'));
  const firm = content.firm || {};
  const assets = content.assets || {};

  // --- Registration line (conditional SEC vs. state; state pulls the overlay line, §5.5) ---
  const cond = (rules.conditional_rules || []).find((c) => c.when && c.when.registration === firm.registration);
  let registrationLine = '';
  if (firm.registration === 'state') {
    const stateCode = String(firm.state || '').toLowerCase();
    try {
      const overlay = readFileSync(join(dir, 'disclosures', 'state-overlays', `${stateCode}.md`), 'utf8');
      registrationLine = parseOverlayRegistrationLine(overlay) || '';
    } catch { /* no overlay for this state → fall through to generic conditional template */ }
  }
  if (!registrationLine && cond) {
    registrationLine = fill(cond.template, { firm_name: firm.name, state: firm.state });
  }
  registrationLine = fill(registrationLine, { firm_name: firm.name, state: firm.state });

  // --- Footer disclosures (required_disclosures with footer placement, §18.2) ---
  const disclosures = (rules.required_disclosures || [])
    .filter((d) => hasPlacement(d, 'footer'))
    .map((d) => d.template);

  // --- Footer links (required_elements with footer placement → ADV 2A/2B, CRS, Privacy) ---
  const linkKindToAsset = {
    adv_2a: assets.adviser2aUrl,
    adv_2b: assets.adviser2bUrl,
    crs: assets.crsUrl,
    privacy: assets.privacyUrl,
  };
  const links = (rules.required_elements || [])
    .filter((e) => hasPlacement(e, 'footer'))
    .map((e) => {
      const href = linkKindToAsset[e.link_kind] || null;
      return { label: e.label, href, missing: !href };
    });

  return {
    registrationLine,
    disclosures,
    links,
    rulesetVersion: `${industry}/${version}`,
  };
}
