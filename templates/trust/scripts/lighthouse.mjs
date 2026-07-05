// Lighthouse quality gate (PRD §6.10 / §7.11). Builds are blocked below:
//   Performance >= 95 · Accessibility >= 90 · SEO >= 95 · Best-Practices >= 95
//
// SCAFFOLD (ticket 016 checkpoint): the runner + thresholds are wired here; the actual
// headless-Chrome Lighthouse pass over `dist/` is finished AFK after the Trust design sign-off
// (it needs the deployed/preview URL or a `astro preview` server + lighthouse dependency).
// Until then this fails loud rather than pretending to pass.

export const THRESHOLDS = { performance: 95, accessibility: 90, seo: 95, 'best-practices': 95 };

const WIRED = false; // flip to true once the real audit below is implemented (AFK follow-up)

if (!WIRED) {
  console.error('[lighthouse] gate not yet wired — run after `astro preview` with lighthouse installed (AFK follow-up to 016).');
  console.error('[lighthouse] thresholds:', THRESHOLDS);
  process.exit(1);
}
