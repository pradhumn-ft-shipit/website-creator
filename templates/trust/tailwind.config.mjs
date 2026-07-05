// Per-customer Tailwind config (PRD §6.4). Brand colors come from src/config/brand.mjs —
// swap that file (done automatically at build time, ticket 024) and the whole Trust site
// re-skins to the customer's palette with no other change.
import { brandColors } from './src/config/brand.mjs';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: brandColors.primary,
          charcoal: brandColors.secondary,
          gold: brandColors.accent, // decorative only (rules, borders, large display) — NOT small text
          // AA-safe editorial gold tones (WCAG 2.1 AA, verified by `npm run a11y`):
          goldink: '#6f5426', // small gold text on light surfaces (paper/mist) — contrast ≥ 4.5
          goldsand: '#cba86a', // gold text/CTA on the navy surface — contrast ≥ 4.5
        },
        // Fixed Trust surface tones — paper/ink read "established, editorial".
        paper: '#faf8f3',
        ink: '#1b1d21',
        mist: '#eceae3',
      },
      fontFamily: {
        // Newsreader (serif display) + Libre Franklin (grotesque body). Distinctive,
        // trustworthy, self-hosted (no external font CDN → clean Best-Practices score).
        serif: ['"Newsreader Variable"', 'Newsreader', 'Georgia', 'serif'],
        sans: ['"Libre Franklin Variable"', '"Libre Franklin"', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        micro: '0.14em',
      },
      maxWidth: {
        prose: '68ch',
      },
    },
  },
  plugins: [],
};
