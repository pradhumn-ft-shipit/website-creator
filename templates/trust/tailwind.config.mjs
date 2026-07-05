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
          gold: brandColors.accent,
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
