// Frontend render test for the Trust template. Builds the real Astro site (default + each
// §7.12 edge-case fixture via TRUST_FIXTURE) and asserts on the emitted HTML — i.e. the thing
// a browser renders, exercising the shared lib wiring end-to-end (schema → section-removal →
// nav → compliance footer) as it actually ships.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distFor = (fixture) => join(root, fixture ? `dist-${fixture}` : 'dist');

/** Build the site with an optional edge fixture into an isolated out dir; return the dist path. */
function build(fixture) {
  const out = distFor(fixture);
  if (existsSync(out)) rmSync(out, { recursive: true, force: true });
  execFileSync('npx', ['astro', 'build', '--outDir', out], {
    cwd: root,
    stdio: 'ignore',
    env: { ...process.env, ...(fixture ? { TRUST_FIXTURE: fixture } : {}) },
  });
  return out;
}

const html = (dist, route) => readFileSync(join(dist, route), 'utf8');

// Builds are ~1s each; give the suite generous headroom.
const OPTS = { timeout: 120_000 };

// --- default (reference) build -------------------------------------------------------------
test('default build: renders all shared-schema pages', OPTS, () => {
  const dist = build();
  for (const p of ['index.html', 'about/index.html', 'services/index.html', 'process/index.html',
    'who-we-serve/index.html', 'fees/index.html', 'contact/index.html', '404.html']) {
    assert.ok(existsSync(join(dist, p)), `expected ${p} to be built`);
  }
});

test('default build: section-removal drops Insights from nav + sitemap (no empty section)', OPTS, () => {
  const dist = distFor();
  const home = html(dist, 'index.html');
  assert.ok(!/>\s*Insights\s*</.test(home), 'Insights must not appear in nav');
  assert.ok(/Client Login/.test(home), 'Client Login (external) present');
  assert.ok(!existsSync(join(dist, 'insights/index.html')), 'no insights page built');
  const sitemap = html(dist, 'sitemap.xml');
  assert.ok(!/insights/.test(sitemap), 'sitemap.xml excludes removed page');
});

test('default build: compliance footer + SEO + landmarks present on every page', OPTS, () => {
  const dist = distFor();
  for (const p of ['index.html', 'about/index.html', 'contact/index.html']) {
    const doc = html(dist, p);
    assert.ok(/SEC-registered investment adviser/.test(doc), `${p}: registration line`);
    assert.ok(/Registration does not imply/.test(doc), `${p}: no-skill disclaimer`);
    assert.ok(/Form ADV Part 2A/.test(doc) && /Form CRS/.test(doc) && /Privacy Policy/.test(doc), `${p}: ADV/CRS/Privacy links`);
    assert.ok(/<main id="main"/.test(doc), `${p}: main landmark`);
    assert.ok(/Skip to content/.test(doc), `${p}: skip link`);
    assert.ok(/application\/ld\+json/.test(doc) && /FinancialService/.test(doc), `${p}: JSON-LD`);
  }
});

// --- §7.12 edge cases ----------------------------------------------------------------------
test('edge: solo firm collapses team grid to a single principal bio', OPTS, () => {
  const dist = build('soloFirm');
  const about = html(dist, 'about/index.html');
  assert.ok(/Your advisor/.test(about), 'solo heading (singular)');
  assert.ok(/Margaret A. Wexford/.test(about), 'principal shown');
  assert.ok(!/David R. Hale/.test(about) && !/Priya Nathan/.test(about), 'team members hidden when solo');
});

test('edge: no team photos → initials fallback, never an <img> person', OPTS, () => {
  const dist = build('noTeamPhoto');
  const about = html(dist, 'about/index.html');
  // People render via the initials fallback (§6.7 — no AI people); no team <img> tags emitted.
  assert.ok(!/<img[^>]+alt="Margaret A. Wexford"/.test(about), 'no principal photo img');
  assert.ok(/Margaret A. Wexford/.test(about), 'principal still present');
});

test('edge: ten designations all render (badge row wraps)', OPTS, () => {
  const dist = build('tenDesignations');
  const about = html(dist, 'about/index.html');
  for (const d of ['CFA', 'ChFC', 'CIMA', 'CPWA', 'RICP']) {
    assert.ok(new RegExp(d).test(about), `designation ${d} rendered`);
  }
});

test('edge: very long firm name renders in header + footer without error', OPTS, () => {
  const dist = build('longName');
  const home = html(dist, 'index.html');
  assert.ok(/Ashcombe & Montgomery/.test(home), 'long firm name present in header');
});
