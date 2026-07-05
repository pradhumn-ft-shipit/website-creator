// Sitemap loading + nav derivation (PRD §6.2). The sitemap (`sitemap.json`) is a versioned,
// code-deploy-free data file: edit it to reorder/rename nav without touching template code.
// `deriveNav` combines it with the resolved-site presence map (sections.mjs) so nav shows
// exactly the pages that were actually built — the "auto-adjust" half of §6.3.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SITEMAP_PATH = join(__dirname, '..', 'sitemap.json');

/** Load the sitemap data file. Injectable path so tests/other industries can point elsewhere. */
export function loadSitemap(path = DEFAULT_SITEMAP_PATH) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Resolve a dotted path like "firm.custodianLoginUrl" against the content object. */
function resolvePath(obj, dotted) {
  return dotted.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

/**
 * Derive the ordered nav from the sitemap + a resolved site.
 * A page appears iff it is `required` OR its `presenceKey` is true in the presence map.
 * External pages (Client Login) resolve their href from the content object.
 *
 * Returns: `[{ key, label, href, external }]` in sitemap order.
 */
export function deriveNav(sitemap, resolved) {
  const { presence, content } = resolved;
  const nav = [];
  for (const page of sitemap.pages) {
    const present = page.required === true || presence[page.presenceKey] === true;
    if (!present) continue;

    if (page.external) {
      const href = resolvePath(content, page.external);
      if (!href) continue; // defensive: presence said yes but href missing → skip rather than emit a dead link
      nav.push({ key: page.key, label: page.label, href, external: true });
    } else {
      nav.push({ key: page.key, label: page.label, href: page.path, external: false });
    }
  }
  return nav;
}

/** Convenience: the internal (buildable) pages only — used to know which .astro routes to render. */
export function internalPages(sitemap, resolved) {
  return deriveNav(sitemap, resolved).filter((n) => !n.external);
}
