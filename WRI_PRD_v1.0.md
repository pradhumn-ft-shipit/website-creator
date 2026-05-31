# Website for Regulatory Industries (WRI)
## Product Requirements Document — v1.0

**Status:** Draft for engineering handoff
**Last updated:** May 31, 2026
**Owner:** Founding team

---

## Table of Contents

1. [Executive Summary & Vision](#1-executive-summary--vision)
2. [Market & Positioning](#2-market--positioning)
3. [Product Scope](#3-product-scope)
4. [User Journeys & Flows](#4-user-journeys--flows)
5. [Compliance Framework](#5-compliance-framework)
6. [Templates & Generated-Site Specification](#6-templates--generated-site-specification)
7. [UI & UX Standards](#7-ui--ux-standards)
8. [AI Generation Strategy](#8-ai-generation-strategy)
9. [System Architecture](#9-system-architecture)
10. [Data Model](#10-data-model)
11. [Admin Tooling](#11-admin-tooling)
12. [Customer Dashboard](#12-customer-dashboard)
13. [Operations](#13-operations)
14. [Legal & Privacy](#14-legal--privacy)
15. [Pricing & Billing](#15-pricing--billing)
16. [Launch Sequence](#16-launch-sequence)
17. [Open Questions & Deferred](#17-open-questions--deferred)
18. [Appendix](#18-appendix)

---

## 1. Executive Summary & Vision

### 1.1 Problem

Solo and small-firm professionals in regulated industries (financial advisors, insurance brokers, mortgage brokers, attorneys, real estate brokers) serve high-value clients but operate websites that are dated, generic, or non-existent. Existing solutions in the financial-advisor space (Twenty Over Ten, FMG, Advisor Websites, AdvisorEvolved) charge several hundred dollars per month for sites that are templated, slow, and still require significant manual effort from the advisor. The compliance burden — SEC marketing rule, FINRA Rule 2210, state bar advertising rules, NMLS disclosures, varying state-level requirements — is a major reason advisors avoid building or updating sites themselves, and a major reason incumbents have moats.

### 1.2 Solution

WRI is a done-for-you website generator for regulated professionals. An advisor signs up, pays a flat $50/month, and within minutes receives a hosted, compliance-aware, production-quality website — either rebuilt from their existing site or generated from uploaded documents. WRI handles scraping, copy generation, compliance validation, template assembly, GitHub repository creation, Vercel deployment, and DNS handoff. Post-launch, advisors edit their site through a chat interface that re-runs compliance validation on every change.

### 1.3 Vision

Become the default website infrastructure for solo and small-firm regulated professionals across five verticals: financial advisory, insurance, mortgage, law, and real estate. Compliance-first is the moat. Speed-to-launch and price are the wedges.

### 1.4 v1 Scope Summary

- **Industry:** SEC-registered and state-registered RIAs (financial advisors only; other four industries on waitlist)
- **Tenancy:** One account = one website
- **Pricing:** $50/month flat, Stripe-billed (payment integration is a placeholder for early alpha)
- **Geography:** United States only, English only
- **Customer count target for v1 launch:** 50 paying customers via private beta
- **Tech stack of generated sites:** Astro + Tailwind, deployed to Vercel
- **Hosting model:** WRI manages the Vercel project and GitHub repo on the advisor's behalf; advisor owns their domain at their existing registrar

---

## 2. Market & Positioning

### 2.1 Ideal Customer Profile (ICP)

- **Firm size:** Solo practitioners and small firms (1–10 team members)
- **AUM range:** $50M–$500M (sweet spot)
- **Registration:** SEC-registered RIAs (>$100M AUM) and state-registered RIAs (<$100M AUM)
- **NOT in v1 ICP:** Broker-dealer-affiliated advisors (FINRA Rule 2210 requires principal pre-approval workflows — different product), wirehouse advisors (their firms own their digital presence)
- **Decision-maker:** Typically the principal/owner, who is also the de facto Chief Compliance Officer

### 2.2 Industry Priority

| Priority | Industry | v1 Status | Reasoning |
|---|---|---|---|
| 1 | Financial Advisory (RIA) | **In v1** | Highest compliance complexity; if we nail RIA, others downscope |
| 2 | Insurance Brokers | Waitlist | NAIC + state insurance dept rules; less complex than RIA |
| 3 | Mortgage Brokers | Waitlist | NMLS disclosures, state-level licensing rules |
| 4 | Attorneys / Law Firms | Waitlist | 50 different state bar advertising rules — hardest to systematize |
| 5 | Real Estate Brokers | Waitlist | MLS/IDX integration adds product complexity |

The onboarding UI displays all five industries; only RIA is clickable. The other four show "Coming soon — join waitlist" with an email capture. Waitlist signups inform which industry to build second.

### 2.3 Competitive Landscape

| Competitor | Pricing | Differentiation Gap WRI Closes |
|---|---|---|
| Twenty Over Ten | $200–$500+/mo | Slow to set up, generic templates, advisor does heavy lifting |
| FMG Suite | $300+/mo | Bloated, expensive, marketing-heavy positioning |
| Advisor Websites | $200+/mo | Dated UX, slow turnaround |
| Smart Asset / SmartAdvisor | Lead-gen, not website | Different product category |
| DIY (Squarespace, Wix, WordPress) | $20–$50/mo | No compliance support; advisor liable for everything |

**Positioning:** *"A compliance-aware website for your advisory practice, built and hosted in minutes for $50 a month."*

### 2.4 Pricing

- **v1:** $50/month per website, billed monthly via Stripe
- **v1.1:** Annual option at $500/year (2 months free)
- **No free trial.** Money-back guarantee if the site fails to deploy.
- **No setup fee, no per-edit fee, no traffic-based fee.**

### 2.5 Value Proposition Hierarchy

1. **Compliance first:** Built for SEC marketing rule, with disclosures, ADV/CRS links, and prohibited-content checks baked in
2. **Fast:** Live site in approximately 15 minutes from payment
3. **Affordable:** $50/month flat vs. $200–$500/month incumbents
4. **Hands-off:** WRI handles repo, deploy, DNS guidance, ongoing edits via chat
5. **Quality:** Astro-based, Lighthouse 95+, WCAG 2.1 AA compliant

---

## 3. Product Scope

### 3.1 In Scope for v1

- RIA-only industry support (SEC + state-registered)
- Conversational onboarding (chat-style, one question at a time)
- Existing-site scraping via Firecrawl
- Document-upload fallback
- Auto-pull of Form CRS / ADV Part 2A & 2B from SEC IAPD by CRD number
- Three differentiated templates (Trust, Modern, Boutique)
- AI copy generation via Gemini 2.5 Pro with three-layer compliance validation
- Up to 2–3 AI-generated images per site (abstract/office/nature only — no people)
- Up to 3 copy revision rounds before deploy
- GitHub repo creation (one per customer) under WRI's GitHub organization
- Vercel project creation and deployment (one per customer)
- DNS handoff via email (Resend) with custom-domain instructions
- Email verification at signup
- DNS-propagation success confirmation email
- Post-launch edit chat (copy edits + page toggle + section reorder)
- Compliance re-validation on every edit before deploy
- Markdown-uploaded blog posts (1–2/month per customer), compliance-validated
- Lead capture form on every generated site (Resend email to advisor + leads dashboard)
- Cloudflare Turnstile + honeypot for spam protection
- Auto-generated privacy policy on each generated site
- Cancellation flow with 30-day grace period followed by takedown
- `/admin` dashboard for WRI team (order tracking, retries, manual review queue)
- `/admin/compliance` tool with AI research agent for ruleset drafting
- Customer dashboard (site overview, asset folder, edit chat, leads inbox, blog uploads, billing)
- Auto-generated platform-side privacy policy, ToS, and DPA template

### 3.2 Explicitly Out of Scope for v1

- Other four industries (insurance, mortgage, law, real estate)
- Broker-dealer-affiliated advisors (FINRA Rule 2210 workflow)
- Multiple websites per account
- Multiple users per account (single login per firm in v1)
- Custom template uploads
- Template switching after deploy
- Adding new pages via edit chat (page toggle and section reorder only)
- AI-generated photos of people
- Domain registration / management (advisor keeps domain at their existing registrar)
- Email hosting on the custom domain
- Analytics dashboard (deferred; Vercel collects underlying data on the project)
- Multi-language site generation
- E-commerce, scheduling, CRM integrations (Cal.com link is provided for white-glove setup only)
- Native mobile apps
- Performance-claim or testimonial content blocks (deferred — high compliance complexity)
- Real-time SEC IAPD sync (initial fetch only at onboarding; re-fetch is manual)

### 3.3 Future Versions (Indicative)

- **v1.1:** Annual billing option, blog SEO suggestions, basic analytics widget
- **v1.5:** Multi-user accounts, multi-website per account, edit chat structure changes (add pages), AI research-agent improvements for compliance updates
- **v2:** Insurance broker vertical, scheduling integration (Cal.com / Calendly native), testimonial blocks with marketing-rule disclosure templates
- **v3:** Remaining three verticals (mortgage, law, real estate), white-label option for firms with multiple advisors

---

## 4. User Journeys & Flows

### 4.1 Primary Onboarding — Advisor with Existing Website

1. **Discovery:** Advisor lands on WRI marketing site, reads value prop, clicks "Get Started"
2. **Account creation:** Email + password (or Google OAuth); email verification link sent via Resend
3. **Email verification:** Advisor clicks verification link, returns to platform
4. **Industry selection:** Picks "Financial Advisory (RIA)" from five-card grid (other four show "Coming soon — join waitlist")
5. **Sub-classification:** Picks "RIA-only" (SEC or state registration handled later via AUM question)
6. **Payment (placeholder for early alpha):** Stripe-hosted $50/month checkout; on success, order is created
7. **Existing-site question:** "Do you have an existing website?" → "Yes, here it is: [URL input]" → scrape job enqueued via Inngest
8. **Industry-specific quick questions while scrape runs (in parallel):**
   - SEC-registered or state-registered? (auto-determined later from CRD if entered)
   - CRD number (optional but recommended — unlocks auto-pull from IAPD)
   - Custodian (dropdown: Schwab, Fidelity, Altruist, Pershing, TD/Schwab, Other)
   - Designations of principals (multi-select: CFP, ChFC, CFA, CPA/PFS, etc., + Other)
9. **Template selection:** Three options shown side-by-side, each previewed with brand colors extracted from scrape if available
10. **Round-1 confirmation:** Show all extracted data (firm name, location, year founded, team size, primary services, ideal client persona, AUM range, fee structure) as confirm-or-correct UI
11. **Asset upload:** Logo (if not extracted), team photos (if not extracted), office photos (optional), any additional documents
12. **Round-2 questions (asked, never inferable):**
    - What makes you different? (one sentence)
    - Who do you serve best?
    - One client story to highlight (we'll anonymize)
    - Photos: office, team, or stock?
    - Blog: yes/no
    - Fees: display or not?
13. **Copy preview:** All generated copy shown for review; advisor can request up to 3 revision rounds via chat or direct text edit
14. **Final approval:** Advisor clicks "Build my site"
15. **Build handoff screen:** "Your site is being built. Check your email in approximately 15 minutes. You can log off — we'll email you when it's ready."
16. **Backend pipeline runs:** Generate → Compliance validate (3 layers) → Create GitHub repo → Push template + content → Create Vercel project → Deploy → Verify deployment → Fetch DNS records from Vercel → Send launch email
17. **Launch email (Resend):** Vercel-subdomain URL, DNS instructions, "your email will not be affected" callout (with bold formatting and red border if MX records detected on domain), Cal.com link for white-glove setup
18. **DNS propagation monitoring:** Advisor updates DNS, WRI verifies via Vercel API on a 6-hour cron for 7 days; when verified, sends DNS-success confirmation email

### 4.2 Alternate Onboarding — No Existing Website

Branches at step 7. "No existing website" → skip scrape, go directly to step 11 (asset upload) with an additional prompt: *"Upload any documents, brochures, or text that describes your business — we'll extract everything we need."*

Accepted formats: PDF, DOCX, TXT, MD, PPTX. Files processed via the same Gemini extraction pipeline (text only — no images extracted from PDFs in v1).

### 4.3 Onboarding Failure — Scrape Returns Nothing Useful

If Firecrawl returns insufficient content (single-page site, JS-only SPA we cannot render, scrape blocked by anti-bot), automatically fall through to the docs-upload path:

> *"We had trouble pulling content from your site — no problem. Upload any documents, brochures, or paste any text describing your practice, and we'll take it from there."*

Logged as a soft-failure event for internal analytics.

### 4.4 Post-Launch Edit Flow

1. Advisor logs into WRI dashboard, opens "Edit my site"
2. Chat interface: "What would you like to change?"
3. AI (Gemini 2.5 Flash) parses the request, identifies affected pages/sections
4. Proposed change shown as a side-by-side diff (before/after)
5. **Layer-2 compliance re-validation** runs automatically (Gemini Flash call against the ruleset)
6. If validation passes: advisor clicks "Approve and publish" → triggers new deployment
7. If validation fails: change blocked, explanation shown, advisor offered an AI-suggested compliant alternative
8. New deployment runs through the same build pipeline; advisor sees "Publishing..." → "Live"
9. Edit logged in the `edits` table with before/after JSON, AI reasoning, compliance result, deployment ID

**Allowed via edit chat in v1:**
- Copy changes (any text on any page)
- Photo swaps (existing assets only — to add new assets, advisor goes to Asset folder first)
- Team member add/remove/update
- Service add/remove/update
- Contact info update
- Toggle optional pages on/off (Insights, Process, Who We Serve, Fees)
- Reorder sections within a page (e.g., move "Team" block above "Services" on Home)

**Not allowed via edit chat in v1:**
- Adding new pages (template-locked)
- Switching templates
- Color/font changes
- Removing required pages (Home, Contact, Disclosures, CRS, ADV, Privacy)
- Editing footer disclosures (those are compliance-managed)

### 4.5 Lead Capture Flow

1. Visitor on a generated site fills out the contact form (name, email, phone, message)
2. Form POSTs to a WRI API route (not stored in the customer's GitHub repo)
3. Server-side validation: Cloudflare Turnstile token check, honeypot field empty, email format valid
4. Lead written to `leads` table, tagged with `site_id`
5. Resend email sent to advisor with the lead details; **reply-to is set to the lead's email address** so the advisor can hit Reply and the conversation goes directly to the lead
6. Lead appears in the advisor's dashboard under "Leads"

### 4.6 Cancellation Flow

1. Advisor clicks "Cancel subscription" in billing settings
2. Confirmation modal: "Your site will remain live for 30 days, then go offline. Continue?"
3. On confirm: Stripe subscription set to cancel at period end; `accounts.subscription_status` set to `pending_cancellation`
4. Email warnings sent at day 0 (confirmation), day 14 (reminder), day 28 (final warning)
5. At day 30: Vercel project deleted, GitHub repo archived (not deleted — kept for 90 days in case of reactivation), `subscription_status` set to `cancelled`
6. Advisor can reactivate within 90 days by paying — full restoration of site

### 4.7 Returning User Edge Case

If a person attempts to sign up with an email already registered:

> *"It looks like you already have a WRI account. [Sign in here] or [Reset your password]."*

No detail disclosed about account status. Standard practice.

---

## 5. Compliance Framework

### 5.1 Philosophy

Compliance is WRI's primary moat. The framework must be:

- **Modular and evolving** (not finalized at v1 — built as a discrete sub-product with its own roadmap)
- **Versioned end-to-end** (every site records which ruleset version it was built against)
- **Researched by AI agents, reviewed by humans** (WRI team approves every ruleset before publishing)
- **Layered at generation, validation, and human-review points**

We explicitly tell customers in the onboarding flow and in the dashboard:

> *"AI can make mistakes. While we've rigorously tested our compliance system, you should review your site's copy before going live, and consult your compliance officer if you have one."*

### 5.2 Three-Layer Compliance Engine

**Layer 1 — Prevention (generation-time):**
- The active compliance ruleset for the customer's industry/sub-industry is injected into the Gemini system prompt
- Generation operates within constraints: forbidden terms, required disclosures, mandated footer elements
- Output is structured JSON matching a versioned schema

**Layer 2 — Validation (post-generation, automated):**
- A separate Gemini Flash call scans output for:
  - Prohibited terms (e.g., "guarantee," "best," "promise," "no risk," "top-ranked," "outperform")
  - Required elements present (footer disclosures, CRS link, ADV link, privacy policy link)
  - State-specific requirements based on advisor's state of registration
- Failed validation creates a `compliance_violations` row and sends the order to the manual review queue

**Layer 3 — Manual Review (human gate):**
- **Active for the first 50 sites WRI ships.** Every site queues for founder review before deploy.
- Reviewer sees: generated copy, ruleset version used, any Layer 2 flags, intake data summary
- Reviewer can: approve, request regeneration with notes, manually edit before deploy
- After 50 clean ships, Layer 3 becomes opt-in (admin-flagged orders only)
- Re-engaged automatically for any new ruleset version (first 10 sites built against new ruleset)

### 5.3 RIA-Specific Compliance — v1 Ruleset

**Required website elements:**
- Form ADV Part 2A (Firm Brochure) — link in footer minimum
- Form ADV Part 2B (Brochure Supplement) — link in footer
- Form CRS (Customer Relationship Summary) — prominent link (footer + dedicated page)
- Privacy notice (Regulation S-P)
- State registration disclosure if state-registered (e.g., *"Registered with the [State] Securities Division"*)
- Disclosure that registration does not imply skill or training

**Prohibited content (Layer 2 blocks these):**
- Performance claims without required calculations (Marketing Rule 206(4)-1)
- Testimonials without proper disclosure (v1: testimonials disallowed entirely; v2 will add compliant testimonial blocks)
- "Guaranteed," "promise," "no risk," "outperform," "best," "top-rated" without substantiation
- Hypothetical performance without disclosures
- Endorsements without compensation disclosure
- Forward-looking statements without risk disclosure

**Footer disclosures (auto-generated, ruleset-driven):**
- Standard registration disclosure
- Link to Form ADV Part 2A & 2B
- Link to Form CRS
- Link to Privacy Policy
- "For informational purposes only" disclaimer
- State registration disclosure if applicable

### 5.4 SEC IAPD Auto-Pull

When the advisor provides their CRD number:

1. Fetch firm record from `adviserinfo.sec.gov` API (via authoritative SEC data endpoint)
2. Pull Form ADV Part 2A/2B and Form CRS PDFs
3. Store in Supabase Storage under the customer's asset namespace
4. Link from the generated site's footer
5. Fall back to scrape from existing site if IAPD fetch fails
6. Fall back to direct upload prompt if scrape also fails

**Re-fetch policy:** Manual only in v1. Advisor can click "Refresh from SEC IAPD" in the Assets section of the dashboard.

### 5.5 State vs. SEC Registration

- AUM question during onboarding determines default classification
- AUM ≥ $100M → SEC-registered, default disclosure set applied
- AUM < $100M → State-registered, additional state-specific disclosure prompts triggered
- Advisor's primary state of registration captured; state-specific ruleset overlay applied (50 state-overlay rulesets to be built incrementally — v1 ships with overlays for top 10 states by RIA count: CA, NY, TX, FL, IL, PA, NJ, MA, GA, OH)

### 5.6 Ruleset Storage & Versioning

```
/compliance/
  /ria/
    /v1.0/
      manifest.json
      rules.json          (machine-readable: forbidden terms, required elements)
      rules.md            (human-readable: rationale, sources, last reviewed)
      disclosures/
        footer-standard.md
        crs-page-template.md
        state-overlays/
          ca.md
          ny.md
          ...
    /v1.1/
      ...
```

- `manifest.json` maps `industry/sub-industry → rule files → versions → published_at → published_by`
- Every site build records `compliance_version_used` in the `generated_content` row
- When a new ruleset version is published, a scheduled job re-validates all live sites; failures appear in the manual review queue with severity tagging

### 5.7 `/admin/compliance` Tool

Internal-only interface for the WRI team to manage rulesets:

- **Research agent:** Trigger an AI agent (Gemini 2.5 Pro with web search) to scan regulator sources (SEC.gov, FINRA notices, state securities boards) for updates since the last published ruleset version. Output: structured diff proposal with citations.
- **Manual editor:** Markdown + JSON side-by-side editor with validation
- **Diff viewer:** Compare versions, see which live sites are affected
- **Publish workflow:** Two-person review for publishing (one drafter + one approver)
- **Re-validation trigger:** On publish, queue all affected sites for Layer 2 re-validation
- **Weekly scheduled scan:** Cron-triggered research agent runs every Monday; results queued for review (does not auto-publish)

### 5.8 Compliance Drift Alerts

When a ruleset update flags an existing site:

1. Violation logged in `compliance_violations` with severity (low / medium / high)
2. Internal review by WRI team
3. If confirmed: email to customer with one-click "approve fix" button
4. On approval: AI generates compliant replacement copy, runs Layer 2 validation, deploys
5. **Customers never receive scary "you're out of compliance" notifications without a paved path to resolution**

### 5.9 Blog Post Compliance

Markdown blog uploads (1–2 per month per customer) run through the same Layer 1 + Layer 2 pipeline before publication:
- Layer 1: AI is given the ruleset and the uploaded MD as context, asked to flag potential issues
- Layer 2: Automated scan for prohibited terms, forward-looking statements, performance claims
- If issues found: customer is shown flagged passages with suggested rewrites
- Customer must explicitly approve the final version before publishing

---

## 6. Templates & Generated-Site Specification

### 6.1 Three Templates

Differentiation is on **aesthetic + information density**, not just layout variations.

| Template | Aesthetic | Target Persona |
|---|---|---|
| **Trust** (traditional) | Serif headings, navy/charcoal palette, advisor photo hero, credentials-heavy, long-form About | Older, conservative advisors; legacy practices |
| **Modern** (clean) | Sans-serif, generous whitespace, big imagery, short copy blocks, gradient or muted accent | Gen X / NextGen-focused advisors |
| **Boutique** (editorial) | Magazine-style, mixed serif/sans, photography-forward, thought-leadership / blog-prominent | Content-producing advisors, RIAs targeting professionals |

All three templates share the same underlying component library and content schema — they differ in styling, typography, and section composition.

### 6.2 Standard RIA Sitemap

Working hypothesis (to be validated via market scan of leading RIA sites pre-launch):

| Page | Required? | Section-Removal Rule |
|---|---|---|
| **Home** | Yes | Always present; hero + sections vary by content availability |
| **About** | Yes | If solo, hide team grid (show single bio inline) |
| **Services** | Yes | Card count 3–6 based on what advisor offers |
| **Our Process** | Optional | Hidden if no process info gathered |
| **Who We Serve** | Optional | Hidden if no client persona info |
| **Insights / Blog** | Optional | Hidden if blog not enabled |
| **Fees** | Optional | Recommended during onboarding; hidden by default if declined |
| **Client Login** | Optional | Shown if custodian portal URL provided |
| **Contact** | Yes | Form + Cal.com embed + office location |
| **Footer everywhere** | Yes | Disclosures, ADV, CRS, Privacy, social links if provided |

Sitemap is stored as `/templates/_shared/sitemap.json`, versioned per industry. Updates do not require a code deploy.

### 6.3 Section Removal Rules

Core principle: **no empty sections.** If the generation step cannot populate a section meaningfully, that section is removed from the build, and the navigation auto-adjusts.

Examples:
- No team uploaded → team grid hidden, single principal bio shown on About
- No services provided → Services page removed entirely from nav
- No process info → "Our Process" page removed
- No blog content → "Insights" removed from nav
- No fee preference → Fees page removed

### 6.4 Tech Stack of Generated Sites

| Layer | Choice | Reasoning |
|---|---|---|
| Framework | Astro | Ships near-zero JS, fast Lighthouse, content-site optimized, great Vercel support |
| Styling | Tailwind CSS | Per-customer `tailwind.config.js` for brand colors |
| Forms | Astro form actions → POST to WRI Next.js API route | Leads land in WRI DB, not customer repo |
| Spam protection | Cloudflare Turnstile + honeypot | Free, effective, no UX friction |
| Analytics | None in v1 | Deferred |
| Hosting | Vercel | Per-customer project, auto-SSL, edge CDN |
| Domain | Custom (advisor-owned) + `.vercel.app` subdomain | Subdomain is fallback if DNS not yet configured |

### 6.5 SEO Defaults (Auto-Included)

- `<title>` and `<meta description>` per page
- Open Graph tags (og:title, og:description, og:image)
- Twitter card tags
- `sitemap.xml` auto-generated at build time
- `robots.txt` with sensible defaults
- JSON-LD `FinancialService` schema with firm address, phone, services
- Favicon generated from logo (multi-resolution: 16x16, 32x32, apple-touch-icon)

### 6.6 Accessibility — WCAG 2.1 AA

- Color contrast ratios verified per template
- Alt text on all images (AI-generated if not provided by advisor)
- Keyboard navigation tested
- ARIA landmarks (header, nav, main, footer)
- Form labels properly associated
- Focus indicators visible

**Enforcement:** Automated Lighthouse + axe-core check runs in CI on every build. Build fails if accessibility score < 90.

### 6.7 Image Strategy

| Image Type | Source | Allowed? | Notes |
|---|---|---|---|
| Logo | Advisor upload or scrape | Required | See §6.8 |
| Team photos | Advisor upload | Optional | Real photos only |
| Office photos | Advisor upload | Optional | Real photos only |
| Stock imagery | Unsplash + Pexels (commercial use, no attribution required) | Yes | `STOCK_PHOTO_CREDITS.md` shipped in repo |
| AI-generated abstract / office / nature | Gemini 2.5 Flash Image (Nano Banana) | **Yes, max 3 per site** | Used only when stock search fails to find a fitting image |
| AI-generated people | — | **Never** | Hard prohibition. SEC marketing rule risk. |
| AI-generated client/testimonial scenes | — | **Never** | Could be misread as actual client imagery |

Total image budget per site: **minimal by design.** Templates prefer typography and whitespace over imagery.

### 6.8 Logo Handling

- **Accepted formats:** PNG, SVG, JPG
- **Auto-processing:** detect background type (transparent vs. solid), extract dominant color (for accent suggestions), generate sized variants (favicon 32x32, header 200x60, social 1200x630)
- **No auto-background removal in v1** — too risky on stylized logos
- **Background question during onboarding:** "Should this logo go on light or dark backgrounds?" — determines template variant selection
- **Fallback if no logo:** generate a clean wordmark using firm name in template heading font; show preview, advisor approves or skips

### 6.9 Standard Hygiene Pages

- **404 page** — matches template aesthetic, "Back home" link, search prompt
- **Privacy Policy** — auto-generated based on industry, state, and form data collection
- **Terms of Service** — auto-generated for the public-facing site (limited liability for advisor)

### 6.10 Performance Budget

- Lighthouse Performance ≥ 95
- Lighthouse SEO ≥ 95
- Lighthouse Accessibility ≥ 90
- Lighthouse Best Practices ≥ 95
- Build fails if any score drops below threshold

---

## 7. UI & UX Standards

WRI's product impression depends on UI quality at two surfaces: the platform itself (what advisors and our internal team use) and the generated customer sites (what advisors' clients see). Both must meet a modern, high-craft standard. This section sets the bar.

### 7.1 Philosophy

The product pitch ("fast, compliant, hands-off, $50/month") is undermined by mediocre UX. Financial advisors are conservative buyers — first impressions during onboarding determine whether they finish signup. Their clients arriving at the generated site form an impression of the advisor's professionalism within seconds. Both surfaces must demonstrate craft from the first pixel.

**Two surfaces, one standard:**
- **Platform UI** — onboarding, customer dashboard, edit chat, asset management, billing, `/admin` tools
- **Generated sites** — the three customer-facing templates (Trust, Modern, Boutique)

Both must be **modern, accessible, fast, and obviously professional.**

### 7.2 Design Principles

1. **Clarity over cleverness.** Every screen answers: what is this, what can I do here, what happens next.
2. **One primary action per screen.** Never make the user hunt for the next step.
3. **Progressive disclosure.** Show what's needed now, hide what isn't, expand on demand.
4. **Conversational where appropriate, structured where not.** Onboarding and edit chat are conversational; team/asset/billing management is structured forms.
5. **Optimistic UI with honest fallbacks.** Immediate feedback on actions; realistic time estimates when work takes time.
6. **Trust through restraint.** No playful animations on critical screens, no dark patterns, no upsell popups during onboarding.
7. **Mobile-aware, not mobile-first.** Platform is used primarily on desktop (advisors work from offices); generated sites must be excellent on mobile (advisors' clients are increasingly on phones).
8. **Real content from day one.** No lorem ipsum in mocks, screenshots, or demos — always design and test against realistic data.

### 7.3 Visual Language — Platform

- Close in feel to Linear, Vercel, Stripe Dashboard, or Cal.com — clean, modern, professional
- Generous whitespace; no dense data tables outside admin views
- One premium sans-serif (Inter or similar); system font fallback acceptable
- Limited palette: neutral grayscale + one brand accent + semantic colors (success / warning / error)
- Subtle elevation (light shadows); no skeuomorphism, no gradients on chrome
- Dark mode optional in v1, expected by v1.5

### 7.4 Visual Language — Generated Sites

Covered in §6.1. Each of the three templates (Trust, Modern, Boutique) is **fully designed**, not a starting point the advisor customizes. The advisor sees a polished result that just needs their content and brand colors. Templates are the product; their quality is non-negotiable.

### 7.5 Component Library

Build on a battle-tested library, never custom primitives:

- **Primary recommendation: shadcn/ui** on Radix primitives — accessible by default, copy-into-codebase (no runtime dependency), Tailwind-native
- **Alternatives if shadcn falls short for specific patterns:** Mantine, Park UI, Tremor (for dashboard charts in v1.1+)
- **Icons:** Lucide (consistent set, MIT licensed)
- **Charts (v1.1+):** Tremor or Recharts
- **Animations:** Framer Motion sparingly; CSS transitions for everything under 300ms

Single library decision must be made before any UI work begins; mixing libraries compounds technical debt.

### 7.6 Usability Standards

Every customer-facing screen must pass these checks before merge:

- **Loading states:** every async action shows a loader within 100ms; actions over 3 seconds show progress or stage indicators with realistic time estimates
- **Empty states:** every list, table, dashboard area, and queue has a designed empty state with explanation and a clear next action (e.g., *"No leads yet. Your contact form is live at [URL]."*)
- **Error states:** human-readable messages that name what went wrong and offer a recovery action; no raw stack traces, no "Something went wrong" without next steps
- **Confirmations:** destructive actions (cancel subscription, replace logo, delete team member) require explicit confirmation; never silent
- **Keyboard accessibility:** every interactive element reachable and operable by keyboard; focus rings visible at all times
- **Form validation:** inline and real-time where helpful (email format, character count); never post-submit-only for predictable issues
- **Help text:** judicious tooltips for complex inputs; never required reading to operate basic flows
- **Tap targets:** minimum 44×44px on mobile

### 7.7 Onboarding-Specific UX

- One question at a time, with progress indicator at top showing total steps
- Each question: question text, optional helper, input, "Back" + "Next" controls
- Extracted-data confirmations follow the **confirm-or-correct** pattern (§7.3): *"We think your firm is X. ✓ Yes / Edit"*
- Auto-save at every step; refresh or accidental close never loses progress
- "Save and continue later" via emailed magic link from any step
- Skip-with-default available on any non-required question
- Total active-time target: **under 10 minutes** for the advisor (excluding background processing)
- Background processing (scrape, generation) status surfaced as a non-blocking indicator at the top of the screen

### 7.8 Edit Chat UX

- Chat input fixed at bottom; conversation scrolls upward
- Each AI response includes: text explanation + diff preview + action buttons (Approve / Reject / Refine)
- Diff preview is **side-by-side or red/green inline** — never "trust me, I changed it"
- Compliance result rendered as a status badge inline with the diff: ✓ Compliant / ⚠ Flagged with reason
- Edit history available via tab in the same view; revert to any past version is one click + confirmation

### 7.9 Asset Folder UX

- Grid of cards, not a file list
- Each card: thumbnail, filename, where-used badge, hover actions (Replace, Remove)
- Drag-and-drop upload zone always visible at top
- Per-file upload progress
- Two-step confirmation modal on any replacement (per §12.4)
- "Used on:" badge on each asset links to its location on the generated site

### 7.10 Admin Tooling UX

Lower fidelity is acceptable for `/admin` since only the WRI team uses it — but lower fidelity does not mean broken. Standards:

- Functional, fast, keyboard-navigable
- Information-dense tables with sortable columns are fine here (unlike the customer dashboard)
- Action buttons clearly labeled (Retry, Manually Intervene, Resolve)
- Every destructive action confirmed
- No marketing-grade polish required, but no broken or half-built screens shipped

### 7.11 Generated-Site Quality Bar

Every shipped customer site must pass:

- Lighthouse Performance ≥ 95 (per §6.10)
- Lighthouse Accessibility ≥ 90 (per §6.10)
- Lighthouse SEO ≥ 95 (per §6.10)
- Lighthouse Best Practices ≥ 95 (per §6.10)
- WCAG 2.1 AA compliance (per §6.6)
- Google Mobile-Friendly Test: pass
- No cumulative layout shift on load
- Hero content loads in under 1.5s on simulated 4G mobile
- All images optimized (WebP/AVIF with JPG/PNG fallback, responsive `srcset`)
- Zero console errors or warnings in production build

The build pipeline blocks deploy if any of these fail.

### 7.12 Design Review Gate

Before any UI ships to customers:

- **Internal review:** founder (and design lead, when hired) signs off on every customer-facing screen
- **Real-content review:** screens tested with realistic advisor data (long firm names, short bios, ten designations, no team photo, all the edge cases) before sign-off
- **Mobile review:** every platform screen reviewed at 375px width even though desktop-first
- **State coverage review:** empty, loading, and error states explicitly walked through, not assumed
- **Accessibility review:** axe-core report reviewed for every new screen

### 7.13 Reference Set — "What Good Looks Like"

For consistent design judgment across the team:

**Platform UI inspiration:**
- **Linear** — speed, keyboard-first, restraint
- **Vercel Dashboard** — deployment status patterns, project list
- **Stripe Dashboard** — billing, account management, subscription state visualization
- **Cal.com** — settings and integration patterns

**Generated-site inspiration** (per template aesthetic):
- **Trust** (traditional): Fisher Investments, Edelman Financial Engines, traditional RIA firm sites
- **Modern** (clean): Wealthfront, Betterment, Facet, Altruist
- **Boutique** (editorial): Daffy, Compound, modern wealth-tech firm sites

---

## 8. AI Generation Strategy

### 8.1 Model Selection

| Use Case | Model | Reasoning |
|---|---|---|
| Initial copy generation | Gemini 2.5 Pro | Quality matters most; this is the product |
| Compliance Layer 2 validation | Gemini 2.5 Flash | Fast, cheap, sufficient for structured rule-checking |
| Post-launch edit chat | Gemini 2.5 Flash | Cheap, fast, sufficient for incremental edits |
| Image generation (when needed) | Gemini 2.5 Flash Image (Nano Banana) | Fast, low-cost; capped at 3 per site |
| Compliance research agent (admin tool) | Gemini 2.5 Pro with web search | Deep research, citation quality |

### 8.2 Prompt Guiding Principles

The exact prompts will be iterated rapidly during alpha. These principles are fixed:

1. **One structured generation call per page batch, not chained calls** — cheaper, faster, contextually coherent across the site
2. **Compliance rulebook lives in the system prompt, not the user prompt** — survives prompt injection from scraped content
3. **Output must be JSON matching a versioned schema** — never free text; downstream code knows the shape
4. **Every generated field carries a `confidence` score (0–1) and `sources` array** — fields below confidence threshold are flagged for human review
5. **Brand voice is captured as a 3–5 line style guide** (extracted from existing site or default per template), included in every call for consistency
6. **All prompts are versioned** (`/prompts/v1/generate-homepage.md`) — every generation records which prompt version produced it
7. **Token budget per page is capped** — if a page exceeds budget, fail loudly rather than silently truncate
8. **Prompt evaluation harness from day 1** — small set of golden test cases (10–20) that every prompt change must pass before merge to main

### 8.3 Question Extraction Strategy

Goal: capture everything in **two rounds maximum.** If Round 3 is needed, something failed upstream.

**Round 1 — inferred from scrape/upload, then confirmed:**
- Firm name
- Location (city, state, ZIP)
- Year founded
- Team size
- Primary services
- Ideal client persona
- AUM range
- Custodian
- Fee structure (AUM %, flat fee, hourly, hybrid)
- Designations of principals
- CRD number (if findable)
- Brand colors (extracted from existing site)

**Round 2 — asked directly, never inferable:**
- What makes you different? (one sentence)
- Who do you serve best? (one sentence)
- One client story to highlight (we'll anonymize)
- Photos: office, team, or stock?
- Blog: yes/no
- Fees displayed: yes/no
- Logo background preference: light or dark?
- Custodian portal URL (if "Client Login" desired)
- Office address (if different from registration address)

UX principle: **show extracted data as "Confirm or correct," not "fill in the blanks."** Massive completion-rate difference.

### 8.4 Token Budget Targets

Indicative budgets (to be tuned during alpha):

| Operation | Target | Hard Cap |
|---|---|---|
| Full-site generation | 30k tokens input, 12k tokens output | 50k input, 20k output |
| Compliance Layer 2 (per page) | 5k input, 1k output | 10k input, 2k output |
| Post-launch edit | 1k input, 500 output | 3k input, 1.5k output |
| Image generation | 1 image | 3 per site total |

### 8.5 Edit Chat Memory Model

Per the principle of cost control, the edit chat does not maintain rolling conversation context.

For each new edit request:
1. Retrieve the last 5 edits as compressed context (~200 tokens of "this is the recent change history")
2. Retrieve the current site copy for the affected page (~500 tokens)
3. Construct a fresh prompt with: ruleset, current copy, edit history, user's request
4. Total context: < 1k tokens per edit
5. Use Gemini 2.5 Flash — fractions of a cent per edit

Conversation messages are stored in `edits` table for audit; they are not re-fed as raw context.

### 8.6 Evaluation Harness

- Golden test cases stored in `/evals/` directory
- Each case: input fixture + expected output properties (not exact text — properties like "footer contains CRS link," "no prohibited terms," "JSON schema valid")
- CI runs evals on every prompt change
- New evals added whenever a real customer hits an edge case worth preventing in future

---

## 9. System Architecture

### 9.1 Stack Overview

| Layer | Choice | Reasoning |
|---|---|---|
| Frontend + backend (WRI platform) | Next.js (App Router) | Server components, mature ecosystem, Vercel integration |
| Hosting (WRI platform) | Vercel | Same ecosystem as customer sites; one less vendor |
| Database | Supabase (Postgres) | Auth + DB + Storage in one; PITR available |
| Auth | Supabase Auth | Email/password + Google OAuth; included with DB |
| File storage | Supabase Storage | Customer assets (logos, team photos, ADV/CRS PDFs) |
| Background jobs | Inngest | Handles long-running pipeline steps beyond Vercel function limits |
| Email | Resend | Lead notifications, transactional emails |
| Scraping | Firecrawl | Free tier sufficient; handles JS rendering, robots.txt, anti-bot |
| Code repositories | GitHub | Personal/founder org in v1; dedicated org in v1.1+ |
| Site hosting (customer) | Vercel | Per-customer project, auto-SSL, custom domain support |
| Payment | Stripe | Subscription billing, money-back refund handling |
| Spam protection | Cloudflare Turnstile | Free, no UX friction |
| Analytics (WRI internal) | TBD post-launch | Not customer-facing in v1 |

### 9.2 Long-Running Work — Inngest Orchestration

**Constraint:** Vercel functions have a hard timeout of 90–120 seconds on most plans. Long-running steps in the pipeline (scrape, generation, build, deploy) will exceed this.

**Solution:** Inngest. Vercel API routes enqueue jobs; Inngest runs the actual work with steps up to 2 hours and automatic retries with exponential backoff.

The pipeline is modeled as Inngest steps:

```
order.created
  └─> scrape.run                  (Firecrawl)
  └─> intake.process              (Gemini extraction from scrape + uploads)
  └─> iapd.fetch                  (SEC IAPD lookup if CRD provided)
  └─> generation.run              (Gemini 2.5 Pro — full-site copy)
  └─> compliance.validate.layer2  (Gemini Flash)
  └─> compliance.review.layer3    (queued if first 50 sites or flagged)
  └─> images.generate             (Gemini Flash Image — only if needed)
  └─> repo.create                 (GitHub API)
  └─> build.assemble              (template + content → files)
  └─> repo.push                   (git push to GitHub)
  └─> vercel.project.create       (Vercel API)
  └─> vercel.deploy               (Vercel build hook)
  └─> vercel.verify               (poll deployment status)
  └─> email.launch                (Resend)
  └─> dns.monitor.start           (cron-triggered job for 7 days)
```

Each step has its own retry policy. Failures escalate to the `/admin/orders` review queue.

### 9.3 Local Development

- Each developer can run the full stack locally
- Supabase local emulator (or shared dev instance — TBD)
- Inngest dev server (local)
- Mocked Vercel + GitHub API responses for development; real APIs in staging/prod
- Gemini calls are real (no local emulator); use a separate `gemini-api-key-dev` with low quotas

### 9.4 Email Deliverability

- Resend sending domain: `mail.wri.com` (or finalized domain)
- SPF, DKIM, DMARC records configured at WRI's domain registrar
- Lead notifications use `noreply@wri.com` as From, with `Reply-To: <lead-email>` so advisor reply-flow works seamlessly
- All transactional emails logged in `email_log` table with Resend message ID for delivery tracking

### 9.5 GitHub Integration

- **Org:** WRI founder's personal GitHub account in v1; migrate to dedicated `wri-customers` org in v1.1
- **Auth:** GitHub App (fine-grained permissions, proper rate limits — never personal access tokens)
- **Repo naming:** `customer-{slug}-{shortid}` where slug is firm-name slugified
- **Visibility:** Private
- **Customer access:** None by default (advisors do not get GitHub accounts; deferred to v2)
- **Commit tagging:** Every commit message includes the order ID or edit ID for traceability

### 9.6 Vercel Integration

- **Account:** WRI Vercel team account
- **One project per customer site**
- **Domain attachment:** Done via Vercel API after deploy succeeds
- **DNS records fetched** via Vercel API and emailed to advisor via Resend
- **Apex + www domain support** with auto-redirect to apex
- **Environment variables per project:**
  - `LEADS_ENDPOINT_URL` (points back to WRI platform)
  - `TURNSTILE_SITE_KEY` (per-customer Turnstile key)
  - `SITE_ID` (for analytics if added in v1.1)

### 9.7 DNS MX Check

Before sending DNS instructions, WRI performs a DNS lookup for MX records on the advisor's custom domain. If MX records exist:

- The "Your email will not be affected" callout in the launch email is rendered in **bold with a red border** for emphasis
- Otherwise, the callout is a plain passing sentence

This avoids unnecessary panic for advisors who don't have email on the domain, while clearly reassuring those who do.

---

## 10. Data Model

### 10.1 Tables

```sql
-- Users (login identities)
users
  id                    uuid pk
  email                 text unique not null
  password_hash         text
  email_verified_at     timestamptz
  google_oauth_id       text
  created_at            timestamptz
  last_login_at         timestamptz

-- Accounts (firms; future-proofs for multi-user teams)
accounts
  id                    uuid pk
  user_id               uuid fk users.id
  firm_name             text
  industry              text  -- 'ria' in v1
  sub_industry          text  -- 'ria_sec' | 'ria_state'
  primary_state         text  -- two-letter state code
  crd_number            text
  stripe_customer_id    text
  stripe_subscription_id text
  subscription_status   text  -- 'trialing' | 'active' | 'pending_cancellation' | 'cancelled' | 'past_due'
  plan                  text  -- 'monthly' | 'annual'
  created_at            timestamptz

-- Orders (one per website build)
orders
  id                    uuid pk
  account_id            uuid fk accounts.id
  status                text  -- see state machine in Appendix
  state_machine_position text
  failure_reason        text
  retry_count           int
  created_at            timestamptz
  completed_at          timestamptz

-- Intake data (captured during onboarding)
intake_data
  id                    uuid pk
  order_id              uuid fk orders.id
  existing_site_url     text
  scrape_result_json    jsonb
  uploaded_doc_paths    text[]
  structured_intake_json jsonb
  -- includes: firm details, team, services, AUM, custodian, designations,
  -- ideal client persona, brand colors, voice guide, etc.

-- Generated content (versioned per page/section)
generated_content
  id                    uuid pk
  order_id              uuid fk orders.id
  version               int
  page                  text  -- 'home' | 'about' | 'services' | etc.
  section               text  -- 'hero' | 'team' | 'cta' | etc.
  content_json          jsonb
  confidence_score      numeric(3,2)
  compliance_version_used text
  generated_at          timestamptz
  approved_at           timestamptz
  approved_by           uuid

-- Assets (uploaded files: logos, team photos, docs)
assets
  id                    uuid pk
  account_id            uuid fk accounts.id
  type                  text  -- 'logo' | 'team_photo' | 'office' | 'doc_adv' | 'doc_crs' | 'doc_other' | 'ai_generated'
  storage_path          text  -- Supabase Storage path
  original_filename     text
  in_use_locations_json jsonb  -- where in the site this is used
  metadata_json         jsonb  -- dimensions, file size, dominant color, etc.
  uploaded_at           timestamptz
  replaced_from_id      uuid fk assets.id  -- audit chain for replacements

-- Team members (separate table; reorderable, photo-linked)
team_members
  id                    uuid pk
  account_id            uuid fk accounts.id
  name                  text
  title                 text
  designations          text[]
  bio                   text
  photo_asset_id        uuid fk assets.id
  linkedin_url          text
  order_index           int

-- Sites (one per account in v1)
sites
  id                    uuid pk
  account_id            uuid fk accounts.id
  template_id           text  -- 'trust' | 'modern' | 'boutique'
  github_repo_url       text
  vercel_project_id     text
  vercel_default_url    text  -- e.g., firmname-abc123.vercel.app
  custom_domain         text
  custom_domain_verified_at timestamptz
  current_content_version int
  last_deployed_at      timestamptz

-- Deployments (every Vercel deploy)
deployments
  id                    uuid pk
  site_id               uuid fk sites.id
  content_version       int
  vercel_deployment_id  text
  status                text  -- 'building' | 'ready' | 'error'
  triggered_by          text  -- 'system' | 'edit_chat' | 'admin'
  compliance_check_passed boolean
  deployed_at           timestamptz

-- Edits (post-launch chat changes)
edits
  id                    uuid pk
  site_id               uuid fk sites.id
  user_id               uuid fk users.id
  page                  text
  section               text
  before_json           jsonb
  after_json            jsonb
  ai_reasoning          text
  compliance_recheck_result jsonb
  deployed_in_deployment_id uuid fk deployments.id
  user_message          text  -- the original chat request from the advisor
  created_at            timestamptz

-- Leads (captured from site contact forms)
leads
  id                    uuid pk
  site_id               uuid fk sites.id
  name                  text
  email                 text
  phone                 text
  message               text
  source_page           text
  turnstile_passed      boolean
  status                text  -- 'new' | 'viewed' | 'archived'
  received_at           timestamptz

-- Compliance rulesets (versioned)
compliance_rulesets
  id                    uuid pk
  industry              text
  sub_industry          text
  version               text  -- e.g., 'ria_v1.2'
  rules_json            jsonb
  rules_markdown        text
  published_at          timestamptz
  published_by          uuid
  retired_at            timestamptz

-- Compliance violations (manual review queue)
compliance_violations
  id                    uuid pk
  order_id              uuid fk orders.id
  edit_id               uuid fk edits.id
  ruleset_version       text
  severity              text  -- 'low' | 'medium' | 'high'
  field_path            text
  violation_description text
  resolved_at           timestamptz
  resolved_by           uuid
  resolution_action     text  -- 'approved' | 'edited' | 'regenerated' | 'rejected'

-- Admin alerts (internal dashboard inbox)
admin_alerts
  id                    uuid pk
  type                  text  -- 'order_failed' | 'compliance_review' | 'manual_intervention'
  order_id              uuid fk orders.id
  site_id               uuid fk sites.id
  payload_json          jsonb
  acknowledged_at       timestamptz
  resolved_at           timestamptz
  created_at            timestamptz

-- Email log (every Resend send)
email_log
  id                    uuid pk
  account_id            uuid fk accounts.id
  template              text  -- 'verify_email' | 'launch' | 'lead' | etc.
  recipient             text
  resend_message_id     text
  status                text  -- 'sent' | 'delivered' | 'bounced' | 'complained'
  sent_at               timestamptz
  delivered_at          timestamptz

-- Waitlist (for the four non-RIA industries)
waitlist
  id                    uuid pk
  email                 text
  industry              text  -- 'insurance' | 'mortgage' | 'law' | 'real_estate'
  created_at            timestamptz

-- Blog posts (advisor-uploaded MD files)
blog_posts
  id                    uuid pk
  site_id               uuid fk sites.id
  title                 text
  slug                  text
  markdown_content      text
  compliance_check_result jsonb
  status                text  -- 'pending_review' | 'approved' | 'published' | 'rejected'
  published_at          timestamptz
  uploaded_at           timestamptz
```

### 10.2 Key Design Decisions

- **Accounts separate from users:** future-proofs for multi-user team accounts in v1.5 without a migration
- **Content is fully versioned:** `generated_content.version` increments on every edit; live version referenced from `sites.current_content_version`. Never destructively updated. Full audit trail.
- **Compliance rulesets are versioned:** every generated piece records which version it was built against → enables "this site was compliant at build time, here's what changed" alerts
- **Assets track usage:** `assets.in_use_locations_json` lets the asset folder UX show "this logo is used on Home/header and footer"
- **`admin_alerts` is the queue:** `/admin/orders` reads from this
- **Email log:** required for deliverability debugging and lead notification audit trail

### 10.3 Deferred / Not in v1

- UTM / referral source tracking on signup (will add when affiliate program is built)
- Multi-tenancy per-row security policies (Supabase RLS) — basic policies in v1, hardened in v1.1
- Audit log table for admin actions (logged but not in dedicated table in v1)

---

## 11. Admin Tooling

### 11.1 `/admin/orders` Dashboard

Internal-only view for the WRI team.

**Order list table columns:**
- Order ID
- Account (firm name + email)
- Created at
- Current state (with color coding)
- Time in current state
- Last failure reason (if any)
- Actions: View detail, Retry, Manually intervene, Cancel

**Filters:**
- By state (especially "needs review," "failed")
- By date range
- By account

**Order detail view:**
- Full state-machine history
- Intake data summary
- Generated content preview
- Compliance violations (if any)
- Deployment logs
- Manual retry / step-through buttons

### 11.2 `/admin/compliance`

Internal-only ruleset management.

**Capabilities:**
- View all rulesets (current + historical versions)
- View "live sites affected" count per ruleset
- Trigger the research agent: Gemini 2.5 Pro with web search scans regulator sources for updates since the last published version; output is a structured diff proposal with citations
- Manual editor: side-by-side Markdown + JSON editor with schema validation
- Diff viewer: compare any two versions
- Publish workflow: two-person review required (drafter + approver) before a ruleset can be published
- On publish: triggers Layer 2 re-validation across all affected sites; flagged sites appear in `/admin/compliance/violations`
- Weekly scheduled scan: cron-triggered research agent every Monday; results queued for human review (never auto-publishes)

### 11.3 `/admin/compliance/violations`

Queue view for flagged sites needing human resolution.

- Lists all unresolved `compliance_violations` rows
- Sortable by severity, age, account
- Each row: view violation, view affected site, take action (approve fix, regenerate, manually edit, dismiss)
- Bulk actions for batch resolution

### 11.4 `/admin/leads`

Read-only view of all leads across all customer sites.
- For internal QA: ensure lead-notification emails are being sent and delivered
- For abuse detection: spot patterns of spam getting through Turnstile

### 11.5 `/admin/email-log`

Read-only view of recent Resend sends with delivery status.
- Filterable by template, status, account
- Critical for debugging deliverability issues

---

## 12. Customer Dashboard

### 12.1 Top-Level Navigation

| Section | Purpose |
|---|---|
| **Site Overview** | Current site URL, deployment status, last updated, custom domain status |
| **Edit Site** | Chat interface for post-launch changes |
| **Assets** | Logos, team photos, office photos, documents — view, replace, add |
| **Team** | Add/remove/edit team members (structured form, since photos + bios need consistency) |
| **Leads** | Inbox of all leads from the contact form |
| **Blog** | Upload markdown posts (1–2/month limit) |
| **Billing** | Stripe-managed subscription view, invoices, cancel |
| **Settings** | Account email, password, notification preferences, domain settings |

### 12.2 Site Overview

- Vercel-subdomain URL (always available)
- Custom domain status: "Not configured" / "Pending verification" / "Verified"
- DNS instructions (link to email or inline)
- Last deployed at
- Current template
- "Visit live site" button

### 12.3 Edit Site (Chat Interface)

- Conversational UI: "What would you like to change?"
- AI parses request, identifies pages/sections affected
- Shows proposed diff before publishing
- Compliance re-validation runs automatically
- "Approve and publish" button on success; suggested rewrite on failure
- History view: list of past edits with revert option (revert restores to a previous `generated_content` version)

### 12.4 Assets

- Sidebar tab with sections: Logo, Team Photos, Office Photos, Documents (ADV, CRS, Privacy), Other
- Each asset row shows: filename, file size, where on the site it's used, "Replace" button, "Remove" button
- Drag-and-drop upload zone
- **Two-step confirmation on any change:** modal asks "Update on live site now / Save for next batch update / Cancel"
- New team-member photo upload triggers structured intake form (name, title, designations, bio, LinkedIn) — does not appear on site until form complete
- "Refresh ADV/CRS from SEC IAPD" button (manual re-fetch)

### 12.5 Team

- Structured form for each team member
- Fields: name, title, designations (multi-select dropdown), bio (textarea, character count shown), photo (upload), LinkedIn URL
- Drag-to-reorder list
- Add / Remove with confirmation
- Changes flow through the same compliance + deploy pipeline as edits

### 12.6 Leads

- Inbox-style list: name, email, phone, source page, received-at, status
- Click to view full message
- Mark as "viewed" or "archived"
- "Reply" button opens advisor's mail client with pre-filled to-address
- CSV export
- Lead count badge in nav for unread

### 12.7 Blog

- "Upload new post" → file upload (`.md` only)
- Frontmatter required: `title`, `slug`, `excerpt`, `publish_date`
- Body: standard Markdown
- On upload: automatic Layer 1 + Layer 2 compliance check
- Result shown: passing / flagged
- If flagged: passages highlighted with AI-suggested rewrites
- Advisor must approve final version before publish
- **Limit: 2 posts per calendar month per customer** (warning shown when approaching limit; hard block at limit with friendly upsell message about future expansion)
- Published posts appear under `/insights/{slug}` on the live site (if Insights page enabled in template)

### 12.8 Billing

- Stripe Customer Portal embedded
- Shows: current plan, next billing date, payment method, invoices
- Cancel subscription button → triggers cancellation flow (4.6)

### 12.9 Settings

- Email, password, profile name
- Notification preferences (email frequency for leads, system alerts)
- Domain settings (custom domain status, re-trigger DNS verification)
- Account deletion (separate from subscription cancellation; deletes all data after 30-day grace period)

---

## 13. Operations

### 13.1 Order State Machine

See Appendix 18.1 for the full diagram. High-level:

```
payment_received
  → scraping (skipped if no existing site)
  → scrape_complete | scrape_failed
  → onboarding_in_progress
  → onboarding_complete
  → generating_copy
  → copy_review (advisor sees preview, requests revisions)
  → copy_approved
  → compliance_review_layer2
  → compliance_review_layer3 (first 50 sites)
  → building
  → deploying
  → deployed
  → email_sent
  → live
```

Failure states: `scrape_failed`, `generation_failed`, `compliance_review_failed`, `build_failed`, `deploy_failed`. Each has a defined recovery action.

### 13.2 Failure Recovery

| Failure | Auto-Retry | Then | Customer-Facing Message |
|---|---|---|---|
| `scrape_failed` | None | Fall through to docs-upload flow automatically | "We had trouble pulling content from your site — let's get it from documents instead." |
| `generation_failed` | 1 retry with same params | Admin queue | "We hit a snag, our team is reviewing. Typically resolved in 2–4 hours." |
| `compliance_review_failed` | None | Admin queue (Layer 3) | "Your site is in final review." |
| `build_failed` | 1 retry | Admin queue | "We hit a snag, our team is reviewing." |
| `deploy_failed` | 3 retries with exponential backoff | Admin queue | "Final deployment in progress." |

Every failure beyond auto-retry creates an `admin_alerts` row → surfaces in `/admin/orders` with a one-click retry button and an error trace.

### 13.3 Manual Gates

- **Compliance Layer 3:** first 50 sites; first 10 sites after any new ruleset version publishes; any site with Layer 2 violations
- **Blog post publication:** advisor must approve flagged passages; WRI does not gate this manually in v1
- **High-severity compliance drift on existing site:** WRI team reviews before sending the "approve fix" email to customer

### 13.4 Support Model

- **No SLA in v1**
- Support email + Cal.com link for white-glove setup
- Internal tooling (admin dashboard) is the primary support interface — most "support tickets" are admins resolving failed orders
- All transactional emails include a contact email for support
- FAQ + docs section on marketing site (deferred until post-alpha)

### 13.5 Backup & Disaster Recovery

- **Postgres:** Supabase Point-in-Time Recovery enabled (additional cost ~$25/mo)
- **Customer assets:** Supabase Storage built-in redundancy
- **Customer site source of truth:** GitHub repos (auto-archived for 90 days on cancellation)
- **RPO (Recovery Point Objective):** < 5 minutes (Supabase PITR)
- **RTO (Recovery Time Objective):** < 2 hours for platform restore; customer sites unaffected (hosted on Vercel)

### 13.6 Observability

- Inngest provides built-in step-level observability
- Vercel logs for the platform Next.js app
- Supabase dashboard for DB metrics
- All cross-system events written to `email_log` (for email) and admin_alerts (for failures)
- A simple `/admin/health` page summarizing system status (queue depth, recent failures, deploy success rate)

---

## 14. Legal & Privacy

### 14.1 Generated-Site Legal Content

**Auto-included on every customer site:**
- **Privacy Policy:** auto-generated based on industry + state of operation; covers contact form data collection
- **Terms of Service / Disclaimer:** "for informational purposes only," no advice given via website, etc.
- **Compliance disclosures:** footer-driven from ruleset (ADV/CRS/Privacy links, state registration disclosure, etc.)

### 14.2 Platform-Side Legal Content

**WRI itself needs:**
- **Terms of Service** — covers our service to the advisor
- **Privacy Policy** — covers our handling of advisor PII and lead PII
- **Data Processing Agreement (DPA)** — we are a data processor for the advisor's lead data; provide a DPA template by default in our ToS

These will be auto-generated in v1 (using a template-based generator like Termly or a custom generator with legal review). All three must exist before public launch.

### 14.3 Indemnification

WRI ToS will include a complete indemnification clause — advisor agrees that WRI is not liable for compliance violations on their site (we provide tooling and best efforts; advisor is the registered entity). This is critical and will be drafted with counsel before private beta.

### 14.4 Data Retention

| Data | Retention |
|---|---|
| Advisor account data | For life of account + 30 days after deletion |
| Uploaded documents (PDFs, etc.) | **30 days after site is built**, then auto-deleted from Storage; extracted text retained |
| Generated content | For life of account (full version history) |
| Leads | For life of account; advisor can export and delete |
| Email log | 90 days |
| Compliance violation records | For life of account (audit trail) |
| GitHub repos | For life of account + 90 days after cancellation (archived, not deleted) |
| Backups (Supabase PITR) | 7 days (default) |

### 14.5 GDPR / CCPA Exposure

Even with US-only operations, US state privacy laws (CCPA, CPRA, similar in WA/VA/CT/CO) apply. WRI will:
- Provide a clear privacy notice
- Honor data access and deletion requests (within 30 days)
- Maintain a data inventory
- Not sell or share data with third parties (other than processors like Vercel, Supabase, Resend, Gemini)
- Use processors with appropriate DPAs in place

### 14.6 Advisor PII vs. Lead PII

| Category | Whose PII | WRI Role | Notes |
|---|---|---|---|
| Advisor's own info (email, firm, etc.) | Advisor | Data controller | WRI's privacy policy applies |
| Lead info from contact form | Prospective client of advisor | Data processor (advisor is controller) | DPA in WRI ToS; advisor responsible for downstream handling |

---

## 15. Pricing & Billing

### 15.1 Plan

- **Standard:** $50/month per website, billed monthly via Stripe
- **Annual (v1.1):** $500/year per website (2 months free)

### 15.2 Trial & Refund Policy

- **No free trial**
- **Money-back guarantee:** full refund if the site fails to deploy successfully (operational failure on WRI's side)
- **30-day money-back from go-live:** pro-rated refund if cancellation within 30 days of site going live
- **No refunds after 30 days** beyond pro-rating to end of current billing cycle

### 15.3 Failed Payment Handling

- Stripe attempts 3 retries over 7 days (Stripe default Smart Retries)
- After final failure: `subscription_status` set to `past_due`; advisor sees in-dashboard warning + email notification
- After 14 days `past_due`: site enters 30-day grace period (per §4.6)
- After 30-day grace: site goes offline; account marked `cancelled`

### 15.4 Placeholder for Alpha

Payment integration is a **placeholder** through closed alpha. First 5–10 alpha customers receive the product for free or at heavy discount. Stripe integration is live but not enforced. Full Stripe integration is required before private beta begins.

---

## 16. Launch Sequence

### 16.1 Phase 1 — Closed Alpha

**Duration:** 4–6 weeks

**Target:** 5–10 advisors, free or heavily discounted

**Sourced from:** founder's LinkedIn network, warm intros from existing financial services contacts, targeted outreach

**Goals:**
- Validate end-to-end flow (signup → site live)
- Identify compliance gaps (Layer 2 false positives, Layer 3 catches)
- Tune Gemini prompts based on real-world inputs
- Refine onboarding question flow
- Test failure recovery paths in production

**Success criteria:**
- 5 sites successfully deployed without major manual intervention
- Average build time < 30 minutes (target: < 15)
- Zero compliance violations in deployed sites (Layer 3 caught all issues)
- All advisors complete onboarding without abandoning

**Manual review intensity:** Layer 3 on 100% of sites; founder personally reviews every order

### 16.2 Phase 2 — Private Beta

**Duration:** 8–12 weeks

**Target:** 50 advisors, $50/mo full price, invite-only via waitlist

**Sourced from:** waitlist signups, alpha referrals, targeted content marketing (LinkedIn posts, RIA-focused communities)

**Goals:**
- Validate willingness to pay $50/mo at scale
- Build case studies (with permission)
- Refine onboarding completion rate
- Stress-test failure handling at higher volume
- Validate post-launch edit chat usage patterns

**Success criteria:**
- 50 paying customers
- Onboarding completion rate > 70%
- Net Promoter Score > 30
- < 5% involuntary cancellation rate (failed payments)
- < 10% voluntary cancellation in first 60 days
- Average build time < 15 minutes

**Manual review intensity:** Layer 3 on first 50 sites total, then opt-in; ruleset version 2.0 published mid-beta with Layer 3 re-engaged for first 10 sites on new version

### 16.3 Phase 3 — Public Launch

**Trigger:** Phase 2 success criteria met

**Target:** Open signup; marketing site goes public; SEO and content marketing kick in

**Indicator for industry #2 expansion:** which waitlist has crossed 200 signups (likely insurance or mortgage based on adjacency)

---

## 17. Open Questions & Deferred

### 17.1 Open Questions for Engineering Discovery

- Supabase local dev vs. shared dev instance: which is operationally simpler?
- Inngest vs. Trigger.dev: prototype with both, pick after 1 week
- Exact Firecrawl pricing at scale (free tier handles alpha; need to model beta+ costs)
- Gemini 2.5 Pro pricing at our expected volume (model per-site cost target: < $2)
- Stripe vs. Stripe + Paddle (Paddle handles VAT/sales tax globally — relevant if we expand beyond US)

### 17.2 Deferred to v1.5

- Multi-user accounts (multiple logins per firm)
- Multiple websites per account
- Edit chat: adding new pages
- Analytics dashboard (Vercel Web Analytics or self-hosted Umami)
- Annual billing option (already specified, just deferring implementation)
- GitHub repo export for advisors who want ownership

### 17.3 Deferred to v2

- Insurance broker industry
- Testimonial blocks with marketing-rule disclosure templates
- Scheduling integration (Cal.com / Calendly native embed)
- Performance claim blocks (with required calculations)

### 17.4 Deferred to v3

- Mortgage, law, real estate verticals
- White-label option for multi-advisor firms

### 17.5 Items Requiring External Input

- Legal review of ToS, Privacy, DPA, indemnification language — **before private beta**
- Confirmation of WRI brand name and domain availability — **before alpha**
- GitHub App registration — **before alpha**
- Vercel team account setup with billing — **before alpha**
- Resend domain verification (SPF/DKIM/DMARC at registrar) — **before alpha**
- Stripe account creation + product/price setup — **before private beta**

---

## 18. Appendix

### 18.1 Order State Machine

```
[payment_received]
       │
       ▼
[scraping] ────────► [scrape_failed] ──► [docs_upload_fallback]
       │                                          │
       ▼                                          ▼
[scrape_complete]                          [onboarding_in_progress]
       │                                          │
       └──────────────────►────────────────────── │
                                                  ▼
                                          [onboarding_complete]
                                                  │
                                                  ▼
                                          [generating_copy]
                                                  │
                                                  ├──► [generation_failed] ──► [admin_queue] ──► retry
                                                  ▼
                                          [copy_review] (advisor)
                                                  │
                                                  ├──► [revision_requested] (loop, max 3)
                                                  ▼
                                          [copy_approved]
                                                  │
                                                  ▼
                                          [compliance_review_layer2]
                                                  │
                                                  ├──► [compliance_review_failed] ──► [admin_queue]
                                                  ▼
                                          [compliance_review_layer3] (first 50 sites)
                                                  │
                                                  ├──► [admin_review_required]
                                                  ▼
                                          [building]
                                                  │
                                                  ├──► [build_failed] ──► retry x1 ──► [admin_queue]
                                                  ▼
                                          [deploying]
                                                  │
                                                  ├──► [deploy_failed] ──► retry x3 ──► [admin_queue]
                                                  ▼
                                          [deployed]
                                                  │
                                                  ▼
                                          [email_sent]
                                                  │
                                                  ▼
                                          [live]
                                                  │
                                                  ▼
                                          [dns_monitoring] (cron, 7 days)
```

### 18.2 RIA Compliance Quick-Reference

**Authority sources:**
- SEC.gov — Investment Adviser Marketing Rule, Rule 206(4)-1 (modernized 2021)
- SEC IAPD — adviserinfo.sec.gov (Form ADV, Form CRS database)
- State securities boards (50 states; top 10 prioritized in v1)
- Regulation S-P (privacy)

**Mandatory on every RIA site:**
- Link to Form ADV Part 2A (Firm Brochure)
- Link to Form ADV Part 2B (Brochure Supplement)
- Link to Form CRS (Customer Relationship Summary) — prominent
- Privacy notice
- State registration disclosure (if state-registered)
- General disclaimer that registration does not imply skill or training

**Hard-prohibited content (Layer 2 blocks):**
- "Guarantee," "guaranteed," "promise," "promised"
- "No risk," "risk-free"
- "Best," "top-ranked," "outperform" (without substantiation)
- Specific performance claims without required calculations and disclosures
- Testimonials (v1 — disallowed entirely; v2 will add compliant testimonial blocks)
- Endorsements without compensation disclosure

**Footer template (filled from ruleset):**
```
[Firm Name] is a [SEC|State of XX]-registered investment adviser.
Registration does not imply a certain level of skill or training.
Information on this website is for informational purposes only
and does not constitute investment, tax, or legal advice.

[Form ADV Part 2A]  [Form ADV Part 2B]  [Form CRS]  [Privacy Policy]
```

### 18.3 Schema Reference

See §10 for full schema. Key relationships:

```
users → accounts → orders → intake_data, generated_content
                          ↓
                        sites → deployments, edits, leads, blog_posts

assets ← team_members, generated_content (referenced by ID)

compliance_rulesets → compliance_violations → admin_alerts

email_log (standalone audit trail)
```

### 18.4 Glossary

| Term | Definition |
|---|---|
| **ADV** | Form ADV — disclosure document filed by RIAs with the SEC |
| **AUM** | Assets Under Management |
| **BD** | Broker-Dealer |
| **CRD** | Central Registration Depository — unique identifier for registered advisors |
| **CRS** | Form CRS / Form ADV Part 3 — Customer Relationship Summary |
| **FINRA** | Financial Industry Regulatory Authority (regulates BDs) |
| **IAPD** | Investment Adviser Public Disclosure (SEC's public database) |
| **Marketing Rule** | SEC Rule 206(4)-1, modernized 2021, governs RIA marketing |
| **RIA** | Registered Investment Adviser |
| **SEC** | Securities and Exchange Commission |
| **WRI** | Website for Regulatory Industries (this product) |

---

## Document Control

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-05-31 | Founding team (Claude-assisted) | Initial PRD compiled from grilling sessions |

**Next steps:**
1. Founding team review and sign-off
2. Engineering lead estimation by section
3. Legal counsel review (sections 5, 13)
4. Brand/marketing review (sections 1, 2, 6)
5. Phased build per Launch Sequence (§16)
