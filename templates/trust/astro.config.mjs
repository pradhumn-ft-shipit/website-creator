// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// `site` is overridden per-customer at build time (ticket 024). The placeholder here lets
// the reference build emit absolute canonical/OG URLs and a valid sitemap.xml.
export default defineConfig({
  site: 'https://wexfordhale.example.com',
  integrations: [tailwind({ applyBaseStyles: false })],
  compressHTML: true,
});
