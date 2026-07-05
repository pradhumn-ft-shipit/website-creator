// Single build-time assembly of the site model from @wri/shared. Every page/layout imports
// from here, so section-removal (resolveSite), nav (deriveNav), and the compliance footer
// (buildFooter) are computed ONCE against the content object. Swap `content` for a generated
// object (ticket 020/024) and the whole template re-renders — no template edits.
import { join } from 'node:path';
import { pickFixture } from '@wri/shared/fixtures/edge-cases';
import sitemapData from '@wri/shared/sitemap.json' with { type: 'json' };
import { validateContent } from '@wri/shared/content-schema';
import { resolveSite } from '@wri/shared/sections';
import { deriveNav, internalPages } from '@wri/shared/sitemap';
import { buildFooter } from '@wri/shared/footer';

// The content object. Defaults to the reference fixture; the render test overrides it with an
// §7.12 edge-case fixture via TRUST_FIXTURE. At real build time (024) generation supplies this.
export const content = pickFixture(process.env.TRUST_FIXTURE);

// Fail the build loud if the content object doesn't satisfy the schema contract (§7.11).
const { ok, errors } = validateContent(content);
if (!ok) {
  throw new Error(`[trust] content object fails schema validation:\n - ${errors.join('\n - ')}`);
}

// Locate the compliance artifacts via cwd (= the template dir at `astro build` time). This is
// robust to Vite relocating this module into dist/chunks (import.meta.url is not). At real
// build time (024) the resolved ruleset is injected by the 006 loader instead.
const complianceDir = join(process.cwd(), '..', '..', 'compliance');

export const sitemap = sitemapData;
export const resolved = resolveSite(content);
export const presence = resolved.presence;
export const nav = deriveNav(sitemap, resolved);
export const navInternal = internalPages(sitemap, resolved);
export const footer = buildFooter({ content, complianceDir });
