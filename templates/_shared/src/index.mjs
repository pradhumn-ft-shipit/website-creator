// @wri/shared — the Astro foundation all three templates (Trust/Modern/Boutique) share.
// Content schema (the 020 contract) + section-removal + sitemap→nav + compliance footer +
// SEO defaults. Templates import from here; they never re-implement any of it.

export { SITE_CONTENT_SCHEMA_VERSION, REMOVABLE_SECTIONS, validateContent } from './content-schema.mjs';
export { resolveSite, isSectionPopulated, hasTeam } from './sections.mjs';
export { loadSitemap, deriveNav, internalPages } from './sitemap.mjs';
export { buildFooter } from './footer.mjs';
export { buildSeo, buildJsonLd, buildRobots, buildSitemapXml } from './seo.mjs';
