// Reference content fixture — a realistic RIA content object matching SITE_CONTENT_SCHEMA_VERSION.
// Used to prove the shared lib + render the Trust template standalone (no live generation).
// Real content only, never lorem (PRD §7.2.8). Fictional firm; any resemblance is coincidental.
//
// This fixture deliberately exercises section-removal: `insights` is disabled (blog off) so the
// Insights page must drop from nav, while every other optional section is populated.

import { SITE_CONTENT_SCHEMA_VERSION } from '../src/content-schema.mjs';

export const referenceContent = {
  schemaVersion: SITE_CONTENT_SCHEMA_VERSION,

  firm: {
    name: 'Wexford & Hale Wealth Management',
    tagline: 'Steady, independent counsel for families building a lasting legacy',
    registration: 'sec',
    crd: '284915',
    phone: '(617) 555-0184',
    email: 'advisors@wexfordhale.com',
    logoUrl: null, // wordmark fallback (§6.8) — no AI-generated logo
    ogImageUrl: null,
    address: {
      street: '75 State Street, Suite 2600',
      city: 'Boston',
      region: 'MA',
      postalCode: '02109',
      country: 'US',
    },
    socialUrls: ['https://www.linkedin.com/company/wexford-hale'],
    calcomUrl: 'https://cal.com/wexford-hale/intro',
    custodianLoginUrl: 'https://client.schwab.com/login',
  },

  brand: {
    // Trust palette: deep navy + warm charcoal + restrained gold accent.
    primary: '#1c2b4a',
    secondary: '#2a2f36',
    accent: '#9a7b4f',
  },

  assets: {
    adviser2aUrl: 'https://reports.adviserinfo.sec.gov/reports/ADV/284915/PDF/284915.pdf',
    adviser2bUrl: 'https://wexfordhale.com/disclosures/adv-2b.pdf',
    crsUrl: 'https://wexfordhale.com/disclosures/form-crs.pdf',
    privacyUrl: '/privacy',
  },

  home: {
    hero: {
      heading: 'Wealth management built on a half-century of fiduciary discipline',
      subheading:
        'We serve a select group of families and retirees who want their financial lives managed with patience, transparency, and unwavering attention to detail.',
      ctaLabel: 'Schedule an introduction',
      imageAlt: 'The Wexford & Hale advisory team reviewing a client plan in their Boston office',
    },
    highlights: [
      { label: 'Established', value: '1974' },
      { label: 'Client families', value: '210+' },
      { label: 'Fiduciary standard', value: 'Always' },
    ],
  },

  about: {
    headline: 'Five decades of putting clients first',
    body:
      'Wexford & Hale was founded in 1974 on a simple premise: that a financial advisor should be measured by the durability of the relationships they keep, not the products they sell. As a registered investment adviser, we serve every client under a fiduciary standard — we are legally and ethically obligated to place your interests ahead of our own, on every recommendation, without exception.\n\nOver five decades we have guided families through market cycles, business transitions, and the quiet work of preparing one generation to steward what the last one built. We take on a limited number of relationships so that every client receives the direct attention of a principal, not a rotating cast of junior staff. Our counsel is comprehensive: investment management, retirement income planning, tax-aware strategy, and estate coordination, all under one roof and one plan.',
    principal: {
      name: 'Margaret A. Wexford',
      title: 'Managing Principal & Chief Investment Officer',
      credentials: ['CFA', 'CFP®', 'MBA'],
      photoUrl: null, // real photo slot — never AI-generated (§6.7)
      photoAlt: 'Margaret A. Wexford, Managing Principal',
      bio:
        'Margaret has advised families for more than thirty years and leads the firm’s investment committee. She holds the Chartered Financial Analyst designation and is a CERTIFIED FINANCIAL PLANNER™ professional.',
    },
    team: [
      {
        name: 'David R. Hale',
        title: 'Principal & Director of Financial Planning',
        credentials: ['CFP®', 'CPA'],
        photoUrl: null,
        photoAlt: 'David R. Hale, Principal',
        bio: 'David leads the firm’s planning practice, with particular depth in retirement income and tax-aware withdrawal strategy.',
      },
      {
        name: 'Priya Nathan',
        title: 'Senior Wealth Advisor',
        credentials: ['CFP®', 'CDFA®'],
        photoUrl: null,
        photoAlt: 'Priya Nathan, Senior Wealth Advisor',
        bio: 'Priya works closely with clients navigating life transitions, including divorce, inheritance, and the sale of a closely held business.',
      },
    ],
  },

  services: [
    { title: 'Investment Management', description: 'Globally diversified, evidence-based portfolios built around your goals, time horizon, and tolerance for risk — reviewed continuously, never left on autopilot.' },
    { title: 'Retirement Income Planning', description: 'A durable, tax-aware plan for turning a lifetime of savings into dependable income that lasts as long as you do.' },
    { title: 'Tax-Aware Strategy', description: 'Coordination of asset location, gains realization, and charitable giving to keep more of what your portfolio earns.' },
    { title: 'Estate & Legacy Coordination', description: 'We work alongside your attorney and accountant to align your investments with the legacy you intend to leave.' },
    { title: 'Family Governance', description: 'Preparing the next generation to inherit responsibly — with education, structure, and candid conversation.' },
  ],

  process: {
    headline: 'A deliberate, unhurried process',
    steps: [
      { title: 'Discovery', description: 'We begin by understanding your family, your obligations, and what financial security actually means to you — before a single recommendation is made.' },
      { title: 'Plan', description: 'We build a written plan spanning investments, income, tax, and estate — and we walk you through every assumption behind it.' },
      { title: 'Implement', description: 'We put the plan to work with disciplined, low-cost execution and full transparency on every position and fee.' },
      { title: 'Steward', description: 'We meet on a regular cadence, adjust as your life changes, and remain reachable directly between reviews.' },
    ],
  },

  whoWeServe: {
    headline: 'The families we serve best',
    personas: [
      { title: 'Retirees & pre-retirees', description: 'Households within ten years of retirement who want certainty about whether their money will last.' },
      { title: 'Multi-generational families', description: 'Families intent on transferring wealth — and values — to the next generation with care.' },
      { title: 'Business owners in transition', description: 'Owners preparing to sell or step back, who need their personal and business finances brought into one plan.' },
    ],
  },

  // Blog intentionally OFF — proves the section-removal engine drops Insights from nav.
  insights: { enabled: false },

  fees: {
    headline: 'Transparent, aligned fees',
    body:
      'We are compensated solely through a transparent advisory fee based on the assets we manage for you. We accept no commissions and sell no proprietary products, so our only incentive is your long-term success. Our fee schedule is disclosed in full in our Form ADV Part 2A, and we will walk you through exactly what you pay before you ever become a client.',
    tiers: [
      { label: 'First $2,000,000', value: '1.00% annually' },
      { label: 'Next $3,000,000', value: '0.75% annually' },
      { label: 'Above $5,000,000', value: '0.50% annually' },
    ],
  },

  contact: {
    headline: 'Begin a conversation',
    body: 'We take on a limited number of new relationships each year. If you would like to explore whether we are the right fit, we would welcome an introductory conversation — there is no cost and no obligation.',
    showForm: true,
  },
};

export default referenceContent;
