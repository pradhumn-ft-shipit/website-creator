// Accessibility quality gate (PRD §6.6 / §7.11) — axe-core, WCAG 2.1 AA. Build fails on any
// serious/critical violation.
//
// SCAFFOLD (ticket 016 checkpoint): thresholds + runner shape are fixed here; the axe-core
// pass over the built pages is finished AFK after design sign-off (needs @axe-core/cli or a
// headless browser + the built dist). Fails loud until wired.

export const RULESET = 'wcag21aa';
export const MAX_VIOLATIONS = { critical: 0, serious: 0 };

const WIRED = false;

if (!WIRED) {
  console.error('[a11y] axe-core gate not yet wired — AFK follow-up to 016 (ruleset:', RULESET + ', max:', JSON.stringify(MAX_VIOLATIONS) + ').');
  process.exit(1);
}
