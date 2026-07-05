import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SITE_CONTENT_SCHEMA_VERSION,
  validateContent,
} from '../src/content-schema.mjs';
import { resolveSite, isSectionPopulated, hasTeam } from '../src/sections.mjs';
import { loadSitemap, deriveNav, internalPages } from '../src/sitemap.mjs';
import { buildFooter } from '../src/footer.mjs';
import { buildSeo, buildJsonLd, buildRobots, buildSitemapXml } from '../src/seo.mjs';
import { referenceContent } from '../fixtures/reference-content.mjs';

// Deep-clone the fixture so mutating tests don't bleed into each other.
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---------------------------------------------------------------------------
// content-schema
// ---------------------------------------------------------------------------
test('reference fixture is valid against the schema', () => {
  const { ok, errors } = validateContent(referenceContent);
  assert.equal(ok, true, `expected valid, got: ${errors.join('; ')}`);
});

test('schema flags a wrong version', () => {
  const bad = clone(referenceContent);
  bad.schemaVersion = 'site.v0';
  const { ok, errors } = validateContent(bad);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.startsWith('schemaVersion')));
});

test('schema requires firm.name, home.hero.heading, about.body, contact.headline', () => {
  const bad = clone(referenceContent);
  delete bad.firm.name;
  delete bad.home.hero.heading;
  delete bad.about.body;
  delete bad.contact.headline;
  const { ok, errors } = validateContent(bad);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.startsWith('firm.name')));
  assert.ok(errors.some((e) => e.startsWith('home.hero.heading')));
  assert.ok(errors.some((e) => e.startsWith('about.body')));
  assert.ok(errors.some((e) => e.startsWith('contact.headline')));
});

test('schema requires firm.state when state-registered', () => {
  const bad = clone(referenceContent);
  bad.firm.registration = 'state';
  delete bad.firm.state;
  const { ok, errors } = validateContent(bad);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.startsWith('firm.state')));
});

test('schema version constant is site.v1', () => {
  assert.equal(SITE_CONTENT_SCHEMA_VERSION, 'site.v1');
});

// ---------------------------------------------------------------------------
// section-removal engine
// ---------------------------------------------------------------------------
test('resolveSite: fixture presence — insights removed, everything else present', () => {
  const { presence } = resolveSite(referenceContent);
  assert.deepEqual(presence, {
    home: true,
    about: true,
    contact: true,
    services: true,
    process: true,
    whoWeServe: true,
    insights: false, // blog disabled in fixture
    fees: true,
    clientLogin: true,
  });
});

test('resolveSite: removing services drops the services section', () => {
  const c = clone(referenceContent);
  c.services = [];
  assert.equal(resolveSite(c).presence.services, false);
  delete c.services;
  assert.equal(resolveSite(c).presence.services, false);
});

test('resolveSite: no custodian url hides client login', () => {
  const c = clone(referenceContent);
  delete c.firm.custodianLoginUrl;
  assert.equal(resolveSite(c).presence.clientLogin, false);
});

test('resolveSite: process/whoWeServe/fees drop when unpopulated', () => {
  const c = clone(referenceContent);
  c.process = { headline: 'x', steps: [] };
  delete c.whoWeServe;
  c.fees = { headline: 'x' };
  const { presence } = resolveSite(c);
  assert.equal(presence.process, false);
  assert.equal(presence.whoWeServe, false);
  assert.equal(presence.fees, false);
});

test('hasTeam / isSolo: solo firm collapses team', () => {
  const c = clone(referenceContent);
  delete c.about.team;
  assert.equal(hasTeam(c), false);
  assert.equal(resolveSite(c).isSolo, true);
  assert.equal(resolveSite(referenceContent).isSolo, false);
});

test('isSectionPopulated is callable per-section', () => {
  assert.equal(isSectionPopulated('fees', referenceContent), true);
  assert.equal(isSectionPopulated('insights', referenceContent), false);
});

// ---------------------------------------------------------------------------
// sitemap → nav derivation
// ---------------------------------------------------------------------------
test('deriveNav: fixture nav omits Insights, includes Client Login as external', () => {
  const sitemap = loadSitemap();
  const resolved = resolveSite(referenceContent);
  const nav = deriveNav(sitemap, resolved);
  const keys = nav.map((n) => n.key);
  assert.deepEqual(keys, ['home', 'about', 'services', 'process', 'who-we-serve', 'fees', 'client-login', 'contact']);
  const cl = nav.find((n) => n.key === 'client-login');
  assert.equal(cl.external, true);
  assert.equal(cl.href, referenceContent.firm.custodianLoginUrl);
});

test('deriveNav: required pages always present even if content thin', () => {
  const sitemap = loadSitemap();
  const c = clone(referenceContent);
  c.services = [];
  delete c.process;
  delete c.whoWeServe;
  delete c.fees;
  delete c.firm.custodianLoginUrl;
  c.insights = { enabled: false };
  const nav = deriveNav(sitemap, resolveSite(c));
  assert.deepEqual(nav.map((n) => n.key), ['home', 'about', 'contact']);
});

test('internalPages: excludes external client-login link', () => {
  const sitemap = loadSitemap();
  const pages = internalPages(sitemap, resolveSite(referenceContent));
  assert.ok(!pages.some((p) => p.key === 'client-login'));
  assert.ok(pages.some((p) => p.key === 'home'));
});

// ---------------------------------------------------------------------------
// ruleset-driven compliance footer
// ---------------------------------------------------------------------------
test('footer: SEC firm gets SEC registration line + both footer disclosures + 4 links', () => {
  const footer = buildFooter({ content: referenceContent });
  assert.match(footer.registrationLine, /SEC-registered investment adviser/);
  assert.ok(footer.disclosures.some((d) => /registration does not imply/i.test(d)));
  assert.ok(footer.disclosures.some((d) => /informational purposes only/i.test(d)));
  const labels = footer.links.map((l) => l.label);
  assert.ok(labels.some((l) => /ADV Part 2A/.test(l)));
  assert.ok(labels.some((l) => /ADV Part 2B/.test(l)));
  assert.ok(labels.some((l) => /Form CRS/.test(l)));
  assert.ok(labels.some((l) => /Privacy Policy/.test(l)));
  assert.ok(footer.links.every((l) => l.missing === false), 'all fixture links resolve');
  assert.equal(footer.rulesetVersion, 'ria/v1.0');
});

test('footer: state-registered firm pulls the state overlay registration line', () => {
  const c = clone(referenceContent);
  c.firm.registration = 'state';
  c.firm.state = 'CA';
  const footer = buildFooter({ content: c });
  assert.match(footer.registrationLine, /California Department of Financial Protection/i);
  assert.match(footer.registrationLine, /Wexford & Hale/);
});

test('footer: missing asset link is flagged (never silently dropped)', () => {
  const c = clone(referenceContent);
  delete c.assets.crsUrl;
  const footer = buildFooter({ content: c });
  const crs = footer.links.find((l) => /Form CRS/.test(l.label));
  assert.equal(crs.missing, true);
  assert.equal(crs.href, null);
});

// ---------------------------------------------------------------------------
// SEO defaults
// ---------------------------------------------------------------------------
test('buildSeo: page title composes with firm name + og/twitter present', () => {
  const seo = buildSeo({ content: referenceContent, page: { title: 'About', path: '/about', description: 'Our story' }, siteUrl: 'https://wexfordhale.com' });
  assert.equal(seo.title, 'About · Wexford & Hale Wealth Management');
  assert.equal(seo.og.siteName, 'Wexford & Hale Wealth Management');
  assert.equal(seo.twitter.card, 'summary'); // no og image in fixture
  assert.equal(seo.canonical, 'https://wexfordhale.com/about');
});

test('buildJsonLd: FinancialService with address + serviceType list', () => {
  const ld = buildJsonLd({ content: referenceContent, siteUrl: 'https://wexfordhale.com' });
  assert.equal(ld['@type'], 'FinancialService');
  assert.equal(ld.name, 'Wexford & Hale Wealth Management');
  assert.equal(ld.address['@type'], 'PostalAddress');
  assert.ok(Array.isArray(ld.serviceType) && ld.serviceType.includes('Investment Management'));
  assert.ok(!('logo' in ld)); // undefined stripped
});

test('buildRobots + buildSitemapXml reflect the derived nav', () => {
  const robots = buildRobots({ siteUrl: 'https://wexfordhale.com' });
  assert.match(robots, /Sitemap: https:\/\/wexfordhale.com\/sitemap.xml/);
  const nav = internalPages(loadSitemap(), resolveSite(referenceContent));
  const xml = buildSitemapXml({ navInternal: nav, siteUrl: 'https://wexfordhale.com' });
  assert.match(xml, /<loc>https:\/\/wexfordhale.com\/about<\/loc>/);
  assert.ok(!/insights/.test(xml), 'removed page not in sitemap.xml');
});
