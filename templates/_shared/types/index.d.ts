// Public type contract for @wri/shared — the shape of the content object every template
// consumes (also the contract ticket 020's generation output must satisfy). Kept broad:
// optional fields are optional so a template may reference `firm.state`, `firm.heroPhotoUrl`,
// etc. without a compile error when a given fixture omits them.

export type Registration = 'sec' | 'state';

export interface Address {
  street?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
}

export interface Firm {
  name: string;
  tagline?: string;
  registration: Registration;
  state?: string;
  crd?: string;
  phone?: string;
  email?: string;
  logoUrl?: string | null;
  ogImageUrl?: string | null;
  heroPhotoUrl?: string | null;
  address?: Address;
  socialUrls?: string[];
  calcomUrl?: string;
  custodianLoginUrl?: string;
  leadEndpoint?: string;
}

export interface Person {
  name: string;
  title?: string;
  credentials?: string[];
  photoUrl?: string | null;
  photoAlt?: string;
  bio?: string;
}

export interface Service { title: string; description?: string; icon?: string; }
export interface Labeled { label: string; value: string; }

export interface SiteContent {
  schemaVersion: string;
  firm: Firm;
  brand?: { primary?: string; secondary?: string; accent?: string };
  assets?: { adviser2aUrl?: string; adviser2bUrl?: string; crsUrl?: string; privacyUrl?: string };
  home: {
    hero: { heading: string; subheading?: string; ctaLabel?: string; imageAlt?: string };
    highlights?: Labeled[];
  };
  about: {
    headline: string;
    body: string;
    principal?: Person;
    team?: Person[];
  };
  services?: Service[];
  process?: { headline: string; steps: { title: string; description: string }[] };
  whoWeServe?: { headline: string; personas: { title: string; description: string }[] };
  insights?: { enabled: boolean; posts?: unknown[] };
  fees?: { headline: string; body?: string; tiers?: Labeled[] };
  contact: { headline: string; body?: string; showForm?: boolean };
}

export interface Presence {
  home: boolean; about: boolean; contact: boolean;
  services: boolean; process: boolean; whoWeServe: boolean;
  insights: boolean; fees: boolean; clientLogin: boolean;
}

export interface ResolvedSite {
  presence: Presence;
  isSolo: boolean;
  content: SiteContent;
}

export interface NavItem { key: string; label: string; href: string; external: boolean; }

export interface Sitemap {
  version: string;
  industry: string;
  pages: { key: string; label: string; path?: string; external?: string; required?: boolean; presenceKey?: string }[];
}

export interface FooterLink { label: string; href: string | null; missing: boolean; }
export interface FooterModel {
  registrationLine: string;
  disclosures: string[];
  links: FooterLink[];
  rulesetVersion: string;
}

export interface SeoModel {
  title: string;
  description: string;
  canonical: string | null;
  og: { title: string; description: string; type: string; siteName: string; image: string | null };
  twitter: { card: string; title: string; description: string; image: string | null };
}

// --- content-schema ---
export const SITE_CONTENT_SCHEMA_VERSION: string;
export const REMOVABLE_SECTIONS: readonly string[];
export function validateContent(content: unknown): { ok: boolean; errors: string[] };

// --- sections ---
export function resolveSite(content: SiteContent): ResolvedSite;
export function isSectionPopulated(key: string, content: SiteContent): boolean;
export function hasTeam(content: SiteContent): boolean;

// --- sitemap ---
export function loadSitemap(path?: string): Sitemap;
export function deriveNav(sitemap: Sitemap, resolved: ResolvedSite): NavItem[];
export function internalPages(sitemap: Sitemap, resolved: ResolvedSite): NavItem[];

// --- footer ---
export function buildFooter(args: { content: SiteContent; industry?: string; version?: string; complianceDir?: string }): FooterModel;

// --- seo ---
export function buildSeo(args: { content: SiteContent; page?: { title?: string; description?: string; path?: string; ogImage?: string }; siteUrl?: string }): SeoModel;
export function buildJsonLd(args: { content: SiteContent; siteUrl?: string }): Record<string, unknown>;
export function buildRobots(args: { siteUrl?: string }): string;
export function buildSitemapXml(args: { navInternal: NavItem[]; siteUrl?: string }): string;
