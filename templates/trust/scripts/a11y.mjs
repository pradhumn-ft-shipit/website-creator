// Accessibility quality gate (PRD §6.6 / §7.11) — axe-core, WCAG 2.1 AA. Runs axe in a real
// headless Chrome over every shipped page and EXITS NON-ZERO on any serious/critical violation
// so the build is blocked. Moderate/minor issues are printed but don't fail the gate.
//
// Run via `npm run a11y` (which builds first).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import puppeteer from 'puppeteer';
import { routes, withPreviewServer } from './lib/harness.mjs';

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core'), 'utf8');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const BLOCKING = new Set(['serious', 'critical']);

const exitCode = await withPreviewServer(async (base) => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  let blockingTotal = 0;

  for (const route of routes()) {
    const page = await browser.newPage();
    await page.goto(`${base}${route}`, { waitUntil: 'networkidle0' });
    await page.evaluate(axeSource);
    const results = await page.evaluate(
      async (tags) => await window.axe.run(document, { runOnly: { type: 'tag', values: tags } }),
      TAGS,
    );

    const blocking = results.violations.filter((v) => BLOCKING.has(v.impact));
    blockingTotal += blocking.length;
    if (results.violations.length === 0) {
      console.log(`✓ ${route.padEnd(16)} 0 violations`);
    } else {
      console.log(`${blocking.length ? '✗' : '•'} ${route}`);
      for (const v of results.violations) {
        console.log(`    [${v.impact}] ${v.id}: ${v.help} — ${v.nodes.length} node(s)`);
      }
    }
    await page.close();
  }

  await browser.close();
  if (blockingTotal > 0) {
    console.error(`\n[a11y] FAIL — ${blockingTotal} serious/critical WCAG 2.1 AA violation(s)`);
    return 1;
  }
  console.log('\n[a11y] PASS — no serious/critical WCAG 2.1 AA violations');
  return 0;
});

process.exit(exitCode);
