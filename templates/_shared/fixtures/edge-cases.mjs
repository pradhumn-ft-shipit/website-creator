// §7.12 real-content edge-case fixtures — the cases a design review must survive:
// long firm name, no team photo, ten designations, solo firm (team grid collapses to a
// single inline bio). Derived from the reference fixture so only the edge dimension changes.
// Templates select one via the TRUST_FIXTURE env var (see trust/src/config/site.mjs); the
// render test builds against each and asserts the rendered result.
import { referenceContent } from './reference-content.mjs';

const clone = () => structuredClone(referenceContent);

/** Solo practice — no team array → team grid hidden, single principal bio inline (§6.3). */
export const soloFirm = (() => {
  const c = clone();
  c.firm.name = 'Aldebaran Financial';
  delete c.about.team;
  return c;
})();

/** Very long firm name — must not overflow the header wordmark or hero (§7.12). */
export const longName = (() => {
  const c = clone();
  c.firm.name = 'Wexford, Hale, Ashcombe & Montgomery Private Wealth Counsel of Greater New England';
  return c;
})();

/** Ten designations on the principal — badge row must wrap gracefully (§7.12). */
export const tenDesignations = (() => {
  const c = clone();
  c.about.principal.credentials = ['CFA', 'CFP®', 'CPA', 'ChFC®', 'CLU®', 'CIMA®', 'CPWA®', 'AIF®', 'RICP®', 'MBA'];
  return c;
})();

/** No team photos provided — every person renders the initials fallback, never an AI person (§6.7). */
export const noTeamPhoto = (() => {
  const c = clone();
  c.firm.heroPhotoUrl = null;
  if (c.about.principal) c.about.principal.photoUrl = null;
  (c.about.team || []).forEach((p) => { p.photoUrl = null; });
  return c;
})();

export const EDGE_FIXTURES = { soloFirm, longName, tenDesignations, noTeamPhoto };

/** Resolve a fixture by name (env-driven); falls back to the reference content. */
export function pickFixture(name) {
  return EDGE_FIXTURES[name] || referenceContent;
}
