// robots.txt with a sitemap reference (§6.5).
import type { APIRoute } from 'astro';
import { buildRobots } from '@wri/shared/seo';

export const GET: APIRoute = ({ site }) => {
  return new Response(buildRobots({ siteUrl: site?.toString() }), {
    headers: { 'Content-Type': 'text/plain' },
  });
};
