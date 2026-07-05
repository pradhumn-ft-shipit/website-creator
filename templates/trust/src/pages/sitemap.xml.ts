// sitemap.xml generated from the section-removal-derived nav (§6.5) — never lists a removed page.
import type { APIRoute } from 'astro';
import { buildSitemapXml } from '@wri/shared/seo';
import { navInternal } from '../config/site.mjs';

export const GET: APIRoute = ({ site }) => {
  const xml = buildSitemapXml({ navInternal, siteUrl: site?.toString() });
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
};
