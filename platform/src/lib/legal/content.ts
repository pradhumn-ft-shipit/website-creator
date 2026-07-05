/**
 * WRI platform legal content (ticket 037, PRD §14.2/§14.3/§14.5/§14.6).
 *
 * Deep module: this file is the single source of truth for WRI's own ToS,
 * Privacy Policy, and DPA template copy. Pages under `src/app/legal/*` are
 * thin renderers — they import a `LegalDocument` from here and hand it to
 * `<LegalDocumentView />` (src/components/legal). Nothing outside this file
 * should hard-code legal copy.
 *
 * IMPORTANT — LEGAL_REVIEW_PENDING (PRD §17.5):
 * These are Termly-style AFK drafts, not final legal advice. External
 * counsel review of the ToS, Privacy Policy, DPA, and indemnification
 * language is a hard prerequisite before private beta. `LEGAL_REVIEW_PENDING`
 * is `true` until that review happens; every page reads it and renders a
 * visible "pending counsel review" banner so an unreviewed draft can't ship
 * silently. Flip to `false` only after counsel sign-off is recorded in
 * `state/decisions.md`.
 */

export const LEGAL_REVIEW_PENDING = true as const;

export const LEGAL_REVIEW_NOTE =
  "This page is an AFK-generated draft (Termly-style template), not final legal advice. " +
  "External counsel must review the Terms of Service, Privacy Policy, DPA, and indemnification " +
  "language before private beta (PRD §17.5). Do not rely on this draft in production until that " +
  "review is recorded in state/decisions.md.";

export const COMPANY_NAME = "WRI (Websites for Regulatory Industries)";
export const COMPANY_LEGAL_NAME = "WRI, Inc. [entity name pending formation/counsel]";
export const CONTACT_EMAIL = "privacy@wri.example"; // placeholder — replace with live domain before launch
export const EFFECTIVE_DATE_LABEL = "Draft — effective date to be set upon counsel approval";

/** Sub-processors WRI uses to deliver the service (PRD §14.5, §14.6). */
export const PROCESSORS: { name: string; purpose: string }[] = [
  { name: "Vercel", purpose: "Hosting and deployment for the WRI platform and every generated customer site." },
  { name: "Supabase", purpose: "Postgres database, authentication, and file storage for advisor accounts, leads, and generated content." },
  { name: "Resend", purpose: "Transactional email (account, billing, order-status) and lead-notification email delivery." },
  { name: "Google (Gemini API)", purpose: "AI-generated website copy, compliance validation, and the edit-chat assistant." },
  { name: "Firecrawl", purpose: "Web scraping of an advisor's existing site during onboarding, when the advisor opts to rebuild from it." },
  { name: "Stripe", purpose: "Subscription billing and payment processing." },
  { name: "Cloudflare (Turnstile)", purpose: "Spam/bot protection on every generated site's contact form." },
];

export interface LegalListItem {
  term?: string;
  text: string;
}

export interface LegalSection {
  id: string;
  heading: string;
  paragraphs?: string[];
  list?: (string | LegalListItem)[];
}

export interface LegalDocument {
  slug: "terms" | "privacy" | "dpa";
  title: string;
  shortName: string;
  summary: string;
  sections: LegalSection[];
}

export const TERMS_OF_SERVICE: LegalDocument = {
  slug: "terms",
  title: "Terms of Service",
  shortName: "Terms",
  summary:
    "Governs the subscription relationship between WRI and the advisor (\"you\", \"Customer\") who signs up for a WRI-hosted website. A Data Processing Agreement is incorporated by reference in §10 and applies by default to every account.",
  sections: [
    {
      id: "acceptance",
      heading: "1. Acceptance of terms",
      paragraphs: [
        `These Terms of Service ("Terms") are a binding agreement between ${COMPANY_LEGAL_NAME} ("WRI", "we", "us") and the individual or firm ("Customer", "you", "Advisor") that creates a WRI account. By creating an account, paying the subscription fee, or using the Service, you agree to these Terms.`,
        "The Service is offered only to SEC-registered and state-registered investment advisers operating in the United States. By signing up you represent that your firm meets this eligibility requirement and that the registration information you provide is accurate.",
      ],
    },
    {
      id: "the-service",
      heading: "2. The service",
      paragraphs: [
        "WRI provides a done-for-you website generation and hosting service for regulated financial advisers: intake (via scrape of an existing site or uploaded documents), AI-assisted copy generation, a three-layer compliance review, template assembly, a dedicated GitHub repository, a dedicated Vercel deployment, and DNS handoff to a domain you own.",
        "One account corresponds to one website in v1. Post-launch changes are made through the in-dashboard edit-chat interface, and every edit is re-validated against the active compliance ruleset before publication.",
      ],
    },
    {
      id: "subscription-billing",
      heading: "3. Subscription, billing, and cancellation",
      paragraphs: [
        "The Service is billed monthly at the then-current published rate ($50/month at launch) via Stripe, unless you are part of an alpha cohort receiving the Service free or at a discount as described at signup.",
        "You may cancel at any time from your dashboard. Upon cancellation, your site is taken offline and your GitHub repository and Vercel project are archived — not deleted — for 90 days, after which they may be permanently removed.",
        "Refunds: WRI offers a full refund if your site fails to deploy due to an operational failure on WRI's side, and a pro-rated refund if you cancel within 30 days of your site going live. No refunds are issued for cancellations after 30 days beyond pro-rating to the end of the current billing cycle.",
      ],
    },
    {
      id: "advisor-responsibilities",
      heading: "4. Your responsibilities as the registered entity",
      paragraphs: [
        "You are the registered investment adviser (or a supervised person of one) and remain solely responsible for the accuracy, completeness, and regulatory compliance of the content on your website, including content generated with WRI's tools.",
        "WRI's Layer 1–3 compliance system (prompt-level constraints, automated validation, and manual review for early or flagged sites) is a best-efforts aid, not a substitute for your own review or your firm's compliance program. You must review generated content before and after publication and are responsible for promptly requesting corrections through the edit-chat interface or by contacting support.",
        "You are responsible for the accuracy of information you provide during onboarding (including SEC/state registration numbers, disclosures, and firm details) and for maintaining your domain registration and DNS records.",
      ],
    },
    {
      id: "indemnification",
      heading: "5. Indemnification and limitation of liability (PRD §14.3)",
      paragraphs: [
        "To the maximum extent permitted by law, WRI is not liable for compliance violations, regulatory action, client disputes, or third-party claims arising from the content of your website. WRI provides tooling, generation assistance, and best-efforts automated and manual compliance review — you, as the registered investment adviser, are the party responsible for your website's content and its compliance with applicable securities law, state regulation, and your firm's own compliance obligations.",
        "You agree to indemnify, defend, and hold harmless WRI, its officers, employees, and contractors from and against any claims, damages, losses, and expenses (including reasonable legal fees) arising out of or related to: (a) content published on your website, whether AI-generated, uploaded, or edited by you; (b) your breach of these Terms or of applicable law or regulation; or (c) inaccurate information you supplied during onboarding or thereafter.",
        "To the maximum extent permitted by law, WRI's total liability arising out of or relating to the Service is limited to the amount you paid WRI in the twelve (12) months preceding the claim. WRI disclaims all implied warranties, including merchantability and fitness for a particular purpose, to the extent permitted by law.",
        "[Placeholder — this clause is a starting draft. The complete indemnification and limitation-of-liability language must be finalized with counsel before private beta per PRD §14.3 and §17.5.]",
      ],
    },
    {
      id: "acceptable-use",
      heading: "6. Acceptable use",
      paragraphs: [
        "You may not use the Service to publish content that is false, misleading, defamatory, or that violates applicable securities law or advertising rules; to impersonate another firm or individual; or to attempt to circumvent the compliance validation system.",
        "Per WRI's compliance rules, AI-generated images may never depict people, hands holding documents, or anything resembling client or advisor likenesses. This restriction cannot be disabled by Customer request.",
      ],
    },
    {
      id: "termination",
      heading: "7. Suspension and termination",
      paragraphs: [
        "WRI may suspend or terminate your access if you fail to pay subscription fees (following Stripe's standard retry schedule and a grace period, as described in your dashboard), materially breach these Terms, or publish content that a Layer 3 manual review determines poses a compliance or legal risk that you do not promptly remediate.",
      ],
    },
    {
      id: "changes",
      heading: "8. Changes to these terms",
      paragraphs: [
        "WRI may update these Terms from time to time. Material changes will be notified by email to the address on your account at least 14 days before taking effect. Continued use of the Service after that date constitutes acceptance.",
      ],
    },
    {
      id: "governing-law",
      heading: "9. Governing law",
      paragraphs: [
        "[Placeholder — governing law and venue to be specified with counsel based on WRI's entity formation jurisdiction.]",
      ],
    },
    {
      id: "dpa-incorporation",
      heading: "10. Data Processing Agreement",
      paragraphs: [
        `WRI acts as a data processor with respect to prospective-client ("lead") data submitted through your website's contact form; you act as the data controller for that data. The WRI Data Processing Agreement (DPA), available at /legal/dpa, is incorporated into these Terms by reference and applies automatically to every account — no separate signature is required.`,
      ],
    },
    {
      id: "contact",
      heading: "11. Contact",
      paragraphs: [`Questions about these Terms can be sent to ${CONTACT_EMAIL}.`],
    },
  ],
};

export const PRIVACY_POLICY: LegalDocument = {
  slug: "privacy",
  title: "Privacy Policy",
  shortName: "Privacy",
  summary:
    "Describes how WRI collects, uses, and protects advisor (customer) personal information and prospective-client (\"lead\") data submitted through generated sites, including the controller/processor split and CCPA/CPRA rights (PRD §14.5, §14.6).",
  sections: [
    {
      id: "scope",
      heading: "1. Scope and roles",
      paragraphs: [
        "This Privacy Policy covers two distinct categories of personal information, and WRI plays a different role for each (PRD §14.6):",
      ],
      list: [
        { term: "Advisor account data", text: "your name, firm name, email, billing details, and onboarding materials. WRI is the data controller for this information — this Privacy Policy governs it directly." },
        { term: "Lead data", text: "information a prospective client submits through the contact form on your generated website. You (the advisor) are the data controller for lead data; WRI is a data processor acting on your instructions. See the Data Processing Agreement (/legal/dpa) for the terms governing WRI's processing of lead data." },
      ],
    },
    {
      id: "data-inventory",
      heading: "2. Data inventory — what we collect",
      list: [
        { term: "Account & identity", text: "name, email, firm name, SEC/state registration identifiers, password hash, authentication tokens." },
        { term: "Billing", text: "billing address and subscription status via Stripe. WRI does not store full card numbers." },
        { term: "Onboarding content", text: "your existing site URL, uploaded documents (PDF/DOCX/PPTX), extracted text, and brand assets, used to generate your site." },
        { term: "Generated content", text: "every version of AI-generated and edited copy for your site, retained for the life of your account." },
        { term: "Lead data", text: "name, email, phone, and message submitted via your site's contact form, plus Turnstile spam-check metadata." },
        { term: "Usage & support", text: "dashboard activity, edit-chat conversation history, and support communications." },
        { term: "Operational logs", text: "email delivery logs (90-day retention), compliance-validation logs, and order-state audit trail (retained for the life of the account)." },
      ],
    },
    {
      id: "use-of-data",
      heading: "3. How we use data",
      list: [
        "To provide the Service: generate, validate, deploy, and maintain your website.",
        "To operate your account: billing, authentication, support, and status notifications.",
        "To forward leads: lead-capture submissions are relayed to you (the advisor) by email; WRI does not use lead data for its own marketing.",
        "To improve the Service: aggregated, de-identified usage patterns to improve templates and the compliance ruleset.",
        "We do not sell personal information, and we do not share it with third parties other than the processors listed in §5, each bound by an appropriate data processing agreement.",
      ],
    },
    {
      id: "retention",
      heading: "4. Retention (PRD §14.4)",
      list: [
        { term: "Advisor account data", text: "retained for the life of the account plus 30 days after deletion." },
        { term: "Uploaded documents", text: "auto-deleted from storage 30 days after your site is built; extracted text is retained as part of generated-content history." },
        { term: "Generated content", text: "retained for the life of the account (full version history)." },
        { term: "Leads", text: "retained for the life of the account; you can export or delete lead records from your dashboard at any time." },
        { term: "Email log", text: "90 days." },
        { term: "Compliance violation records", text: "retained for the life of the account as an audit trail." },
        { term: "Backups", text: "7-day point-in-time recovery window (Supabase default)." },
      ],
    },
    {
      id: "processors",
      heading: "5. Sub-processors",
      paragraphs: [
        "WRI uses the following processors to deliver the Service. Each processes personal information only under WRI's instructions and an appropriate data processing agreement:",
      ],
      list: PROCESSORS.map((p) => ({ term: p.name, text: p.purpose })),
    },
    {
      id: "ccpa",
      heading: "6. Your rights — CCPA / CPRA and other state privacy laws (PRD §14.5)",
      paragraphs: [
        "California, Washington, Virginia, Connecticut, Colorado, and other states with comprehensive privacy laws give residents rights over their personal information. WRI honors the following rights for advisor account data, regardless of the requester's state of residence:",
      ],
      list: [
        "Right to know / access what personal information WRI holds about you.",
        "Right to request deletion of your personal information, subject to legal retention exceptions described in §4.",
        "Right to correct inaccurate personal information.",
        "Right to opt out of the sale or sharing of personal information — WRI does not sell or share personal information, so this right is satisfied by default.",
        "Right to non-discrimination for exercising any of the above rights.",
      ],
    },
    {
      id: "ccpa-how-to-exercise",
      heading: "7. Exercising your privacy rights",
      paragraphs: [
        `To submit an access, correction, or deletion request, email ${CONTACT_EMAIL} from the address associated with your account. WRI will verify your identity and respond within 30 days, as required by CCPA/CPRA and equivalent state law.`,
        "Leads: if you are a prospective client who submitted information through an advisor's WRI-hosted contact form, WRI is a processor acting on that advisor's instructions — please contact the advisor's firm directly. WRI will assist the advisor in fulfilling your request as required by the Data Processing Agreement.",
      ],
    },
    {
      id: "security",
      heading: "8. Security",
      paragraphs: [
        "WRI uses industry-standard technical and organizational measures — encryption in transit, role-based access control, and least-privilege service accounts — to protect personal information. No system is perfectly secure, and WRI will notify affected customers of any confirmed data breach as required by applicable law.",
      ],
    },
    {
      id: "children",
      heading: "9. Children's privacy",
      paragraphs: [
        "The Service is intended for business use by registered investment advisers and is not directed to children under 16. WRI does not knowingly collect personal information from children.",
      ],
    },
    {
      id: "changes",
      heading: "10. Changes to this policy",
      paragraphs: [
        "WRI may update this Privacy Policy from time to time. Material changes will be notified by email at least 14 days before taking effect.",
      ],
    },
    {
      id: "contact",
      heading: "11. Contact",
      paragraphs: [`Privacy questions or requests can be sent to ${CONTACT_EMAIL}.`],
    },
  ],
};

export const DPA_TEMPLATE: LegalDocument = {
  slug: "dpa",
  title: "Data Processing Agreement (DPA)",
  shortName: "DPA",
  summary:
    "Incorporated into the Terms of Service by default (§10) — governs WRI's processing of prospective-client (\"lead\") data as a processor acting on the advisor's (controller's) instructions (PRD §14.2, §14.6).",
  sections: [
    {
      id: "parties-roles",
      heading: "1. Parties and roles",
      paragraphs: [
        `This Data Processing Agreement ("DPA") is entered into between ${COMPANY_LEGAL_NAME} ("Processor", "WRI") and the Customer identified on the WRI account ("Controller", "you"), and is incorporated by reference into the WRI Terms of Service. It applies automatically to every WRI account — no separate countersignature is required, consistent with PRD §14.2.`,
        "With respect to lead data submitted through the contact form on your WRI-hosted website, you are the Controller and WRI is the Processor. This DPA does not apply to advisor account data, where WRI itself is the controller (see the Privacy Policy).",
      ],
    },
    {
      id: "subject-matter",
      heading: "2. Subject matter and duration",
      paragraphs: [
        "Subject matter: hosting, storage, and relay of prospective-client contact-form submissions (name, email, phone, message) collected via your generated website.",
        "Duration: for as long as your WRI account is active, plus any post-termination period needed to return or delete lead data as described in §6.",
      ],
    },
    {
      id: "processing-instructions",
      heading: "3. Processing instructions",
      paragraphs: [
        "WRI will process lead data only: (a) to receive and relay contact-form submissions to you by email; (b) to store lead records for display, export, and deletion in your dashboard; and (c) to apply spam/bot filtering (Cloudflare Turnstile) at the point of submission. WRI will not use lead data for its own marketing, profiling, or any purpose other than providing the Service to you.",
      ],
    },
    {
      id: "sub-processors",
      heading: "4. Sub-processors",
      paragraphs: [
        "WRI engages the following sub-processors in connection with lead data, each bound by confidentiality and data-protection obligations at least as protective as this DPA:",
      ],
      list: [
        { term: "Supabase", text: "storage of lead records and the database powering your dashboard." },
        { term: "Resend", text: "email delivery of lead notifications to you." },
        { term: "Vercel", text: "hosting of the contact-form endpoint and the platform dashboard." },
        { term: "Cloudflare", text: "Turnstile spam/bot verification at submission time." },
      ],
    },
    {
      id: "security-measures",
      heading: "5. Security measures",
      paragraphs: [
        "WRI maintains technical and organizational measures appropriate to the risk, including encryption in transit, access controls scoped to your account, and the retention schedule described in the Privacy Policy §4. WRI will notify you without undue delay upon confirming a security incident affecting lead data so you can meet any downstream notification obligations to your prospective clients.",
      ],
    },
    {
      id: "assistance",
      heading: "6. Assistance with data subject requests and deletion",
      paragraphs: [
        "You can export or delete lead records directly from your dashboard at any time. Where a prospective client contacts WRI directly with an access or deletion request, WRI will refer the requester to you and provide reasonable assistance in fulfilling the request within the timeframe required by applicable law (e.g., 30 days under CCPA/CPRA).",
        "Upon termination of your account, WRI will make lead data available for export for 90 days and will delete it thereafter, consistent with the retention schedule in the Privacy Policy.",
      ],
    },
    {
      id: "audit",
      heading: "7. Audit and compliance",
      paragraphs: [
        "WRI will, upon reasonable written request no more than once per year, provide information reasonably necessary to demonstrate compliance with this DPA, such as a summary of sub-processor agreements and security practices.",
      ],
    },
    {
      id: "liability",
      heading: "8. Liability",
      paragraphs: [
        "Liability under this DPA is governed by the limitation-of-liability terms in the Terms of Service §5. Nothing in this DPA expands WRI's liability beyond what is set out there.",
        "[Placeholder — this DPA template is a starting draft and must be reviewed by counsel before private beta, alongside the ToS indemnification clause, per PRD §17.5.]",
      ],
    },
    {
      id: "contact",
      heading: "9. Contact",
      paragraphs: [`Questions about this DPA can be sent to ${CONTACT_EMAIL}.`],
    },
  ],
};

export const LEGAL_DOCUMENTS: LegalDocument[] = [TERMS_OF_SERVICE, PRIVACY_POLICY, DPA_TEMPLATE];

export function getLegalDocument(slug: LegalDocument["slug"]): LegalDocument {
  const doc = LEGAL_DOCUMENTS.find((d) => d.slug === slug);
  if (!doc) {
    throw new Error(`Unknown legal document slug: ${slug}`);
  }
  return doc;
}
