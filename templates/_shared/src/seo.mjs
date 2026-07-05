// SEO + structured-data defaults (PRD §6.5). Every generated page gets title/description,
// Open Graph, Twitter card, and a site-level JSON-LD FinancialService node. sitemap.xml +
// robots.txt are generated from the derived nav so they never list a removed page.

/** Per-page <title> + meta description + OG/Twitter tags. */
export function buildSeo({ content, page, siteUrl }) {
  const firm = content.firm || {};
  const firmName = firm.name || 'Advisory Firm';
  const tagline = firm.tagline || content?.home?.hero?.subheading || `${firmName} — independent financial advice`;

  const pageTitle = page?.title
    ? `${page.title} · ${firmName}`
    : `${firmName}${firm.tagline ? ` — ${firm.tagline}` : ''}`;
  const description = (page?.description || tagline || '').slice(0, 300);
  const ogImage = page?.ogImage || firm.ogImageUrl || firm.logoUrl || null;

  return {
    title: pageTitle,
    description,
    canonical: page?.path && siteUrl ? new URL(page.path, siteUrl).toString() : siteUrl || null,
    og: {
      title: pageTitle,
      description,
      type: 'website',
      siteName: firmName,
      image: ogImage,
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title: pageTitle,
      description,
      image: ogImage,
    },
  };
}

/** JSON-LD FinancialService node (§6.5) — firm identity, contact, address, services. */
export function buildJsonLd({ content, siteUrl }) {
  const firm = content.firm || {};
  const node = {
    '@context': 'https://schema.org',
    '@type': 'FinancialService',
    name: firm.name,
    url: siteUrl || undefined,
    telephone: firm.phone || undefined,
    email: firm.email || undefined,
    image: firm.logoUrl || undefined,
    description: firm.tagline || content?.home?.hero?.subheading || undefined,
  };
  if (firm.address) {
    node.address = {
      '@type': 'PostalAddress',
      streetAddress: firm.address.street || undefined,
      addressLocality: firm.address.city || undefined,
      addressRegion: firm.address.region || undefined,
      postalCode: firm.address.postalCode || undefined,
      addressCountry: firm.address.country || 'US',
    };
  }
  if (Array.isArray(content.services) && content.services.length) {
    node.serviceType = content.services.map((s) => s.title).filter(Boolean);
  }
  if (Array.isArray(firm.socialUrls) && firm.socialUrls.length) {
    node.sameAs = firm.socialUrls;
  }
  // Strip undefined for a clean payload.
  return JSON.parse(JSON.stringify(node));
}

/** robots.txt with a sitemap reference (§6.5). */
export function buildRobots({ siteUrl }) {
  const lines = ['User-agent: *', 'Allow: /'];
  if (siteUrl) lines.push(`Sitemap: ${new URL('/sitemap.xml', siteUrl).toString()}`);
  return lines.join('\n') + '\n';
}

/** sitemap.xml from the derived nav's internal pages (§6.5) — never includes a removed page. */
export function buildSitemapXml({ navInternal, siteUrl }) {
  const base = siteUrl ? siteUrl.replace(/\/$/, '') : '';
  const urls = navInternal
    .map((n) => `  <url><loc>${base}${n.href === '/' ? '/' : n.href}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
