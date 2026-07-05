// Per-customer brand colors. At real build time (ticket 024) this file is generated from the
// advisor's intake brand palette; here it derives from the reference fixture so the Trust
// template renders a complete, real-content site standalone. tailwind.config.mjs reads these.
import { referenceContent } from '@wri/shared/fixtures/reference-content';

const brand = referenceContent.brand || {};

// Trust palette defaults (navy / charcoal / gold) — used if a customer omits a color.
export const brandColors = {
  primary: brand.primary || '#1c2b4a', // deep navy — headings, primary CTA, nav
  secondary: brand.secondary || '#2a2f36', // warm charcoal — body ink accents
  accent: brand.accent || '#9a7b4f', // restrained gold — rules, small accents
};

export default brandColors;
