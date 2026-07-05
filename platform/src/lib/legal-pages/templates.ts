/**
 * Generated-site legal + hygiene page copy (PRD §14.1, §6.9).
 *
 * These are the Privacy Policy, Terms of Service / Disclaimer, and 404 page that
 * ship on every generated customer site. They are produced DETERMINISTICALLY
 * (template functions, not a Gemini call): legal boilerplate must be predictable,
 * reviewable, and identical run-to-run — an AI paraphrase of a liability clause
 * is a compliance risk, not a feature. Copy varies by industry, registration
 * (SEC vs. state), and state of operation.
 *
 * Privacy + Terms are REQUIRED, non-removable pages (§4.4 — the edit chat cannot
 * delete them); they are the linked targets of the ruleset-driven footer (016).
 * The output objects are consumed by the templates/build step (024).
 */

export type LegalSlug = "privacy" | "terms" | "not-found";

export interface LegalPageContext {
  firmName: string;
  /** SEC- vs. state-registered RIA — drives disclosures + state privacy law. */
  registration: "sec" | "state";
  /** Two-letter state of operation / registration (e.g. "CA"). */
  state: string | null;
  industry: "ria";
  /** Contact email surfaced in the privacy policy; defaults to a placeholder. */
  contactEmail?: string;
  /** Effective date string; defaults to a stable placeholder for the build. */
  effectiveDate?: string;
}

export interface DocumentSection {
  heading: string;
  body: string;
}

export type LegalPageContent =
  | { kind: "document"; sections: DocumentSection[] }
  | {
      kind: "not_found";
      heading: string;
      message: string;
      backHomeHref: string;
      backHomeLabel: string;
      searchPrompt: string;
    };

export interface LegalPage {
  slug: LegalSlug;
  title: string;
  /** Required pages cannot be removed via edit chat (§4.4). */
  required: boolean;
  removable: boolean;
  /** Rendered markdown body (documents) or a simple render (404). */
  bodyMarkdown: string;
  content: LegalPageContent;
}

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
  ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
};

/** States with a comprehensive consumer-privacy statute → the extra disclosure. */
const STATE_PRIVACY_LAW: Record<string, string> = {
  CA: "the California Consumer Privacy Act (CCPA), as amended by the California Privacy Rights Act (CPRA)",
  VA: "the Virginia Consumer Data Protection Act (VCDPA)",
  CO: "the Colorado Privacy Act (CPA)",
  CT: "the Connecticut Data Privacy Act (CTDPA)",
  UT: "the Utah Consumer Privacy Act (UCPA)",
  TX: "the Texas Data Privacy and Security Act (TDPSA)",
  OR: "the Oregon Consumer Privacy Act (OCPA)",
  MT: "the Montana Consumer Data Privacy Act (MCDPA)",
};

function stateName(code: string | null): string | null {
  if (!code) return null;
  return STATE_NAMES[code.toUpperCase()] ?? null;
}

function renderDocument(sections: DocumentSection[], title: string): string {
  return [
    `# ${title}`,
    "",
    ...sections.flatMap((s) => [`## ${s.heading}`, "", s.body, ""]),
  ].join("\n");
}

export function buildPrivacyPolicy(ctx: LegalPageContext): LegalPage {
  const email = ctx.contactEmail ?? "privacy@your-firm-domain.com";
  const effective = ctx.effectiveDate ?? "the date this site was published";
  const name = stateName(ctx.state);
  const privacyLaw = ctx.state ? STATE_PRIVACY_LAW[ctx.state.toUpperCase()] : undefined;

  const sections: DocumentSection[] = [
    {
      heading: "Overview",
      body:
        `This Privacy Policy explains how ${ctx.firmName} ("we," "us," or "our") ` +
        `collects, uses, and protects information when you visit this website or ` +
        `contact us through it. It is effective as of ${effective}.`,
    },
    {
      heading: "Information We Collect",
      body:
        "We collect the information you voluntarily provide when you submit our " +
        "**contact form** — typically your name, email address, phone number, and " +
        "the contents of your message. We also collect limited technical data " +
        "(such as your browser type and pages visited) through standard web logs.",
    },
    {
      heading: "How We Use Your Information",
      body:
        "We use the information you provide solely to respond to your inquiry and " +
        "to communicate with you about our advisory services. We do not sell your " +
        "personal information.",
    },
    {
      heading: "Protection of Nonpublic Personal Information (Regulation S-P)",
      body:
        "As an investment adviser, we handle any nonpublic personal information " +
        "you provide in accordance with the U.S. Securities and Exchange " +
        "Commission's **Regulation S-P** (the Privacy of Consumer Financial " +
        "Information rule). We maintain physical, electronic, and procedural " +
        "safeguards designed to protect that information and restrict access to " +
        "personnel who need it to serve you.",
    },
  ];

  if (name && privacyLaw) {
    sections.push({
      heading: `Your Privacy Rights (${name})`,
      body:
        `If you are a resident of ${name}, you may have additional rights under ` +
        `${privacyLaw}, including the right to know what personal information we ` +
        `hold about you, to request its deletion, and to opt out of certain ` +
        `processing. To exercise these rights, contact us at ${email}.`,
    });
  } else if (name) {
    sections.push({
      heading: `Your Privacy Rights (${name})`,
      body:
        `If you are a resident of ${name}, you may have rights under applicable ` +
        `state privacy laws. To exercise any such rights, contact us at ${email}.`,
    });
  }

  if (ctx.registration === "state" && name) {
    sections.push({
      heading: "Regulatory Registration",
      body:
        `${ctx.firmName} is an investment adviser registered with the ` +
        `**State of ${name}**. This registration does not imply a certain level ` +
        `of skill or training.`,
    });
  }

  sections.push({
    heading: "Contact Us",
    body: `Questions about this Privacy Policy can be directed to ${email}.`,
  });

  const title = "Privacy Policy";
  return {
    slug: "privacy",
    title,
    required: true,
    removable: false,
    content: { kind: "document", sections },
    bodyMarkdown: renderDocument(sections, title),
  };
}

export function buildTermsOfService(ctx: LegalPageContext): LegalPage {
  const sections: DocumentSection[] = [
    {
      heading: "Informational Purposes Only",
      body:
        `The content on this website is provided by ${ctx.firmName} for ` +
        "**informational purposes only**. Nothing on this site constitutes, or " +
        "should be relied upon as, investment, legal, tax, or accounting advice.",
    },
    {
      heading: "No Advice Through This Website",
      body:
        "No investment advice is given through this website, and no advisory " +
        "relationship is created by your use of it. Investment advice is provided " +
        "only under a written agreement and after a review of your specific " +
        "circumstances. This website does not constitute an offer or solicitation " +
        "in any jurisdiction where we are not appropriately registered or exempt.",
    },
    {
      heading: "Investment Risk",
      body:
        "Investing involves risk, including the possible loss of principal. Past " +
        "performance does not ensure future results. We make no representation " +
        "that any strategy or information on this site is suitable for you.",
    },
    {
      heading: "Third-Party Links",
      body:
        "This site may contain links to third-party websites. We are not " +
        "responsible for the content or accuracy of any third-party site.",
    },
    {
      heading: "Limitation of Liability",
      body:
        `To the fullest extent permitted by law, ${ctx.firmName} shall not be ` +
        "liable for any damages arising out of your access to, or use of, this " +
        "website or its content.",
    },
  ];

  const title = "Terms of Service";
  return {
    slug: "terms",
    title,
    required: true,
    removable: false,
    content: { kind: "document", sections },
    bodyMarkdown: renderDocument(sections, title),
  };
}

export function build404Page(): LegalPage {
  const heading = "Page not found";
  const message =
    "The page you're looking for doesn't exist or may have moved.";
  const searchPrompt = "Try searching or head back to the homepage.";
  const backHomeLabel = "Back to home";
  return {
    slug: "not-found",
    title: "404 — Page Not Found",
    required: false,
    removable: false,
    content: {
      kind: "not_found",
      heading,
      message,
      backHomeHref: "/",
      backHomeLabel,
      searchPrompt,
    },
    bodyMarkdown: `# ${heading}\n\n${message}\n\n${searchPrompt}`,
  };
}

/** The full legal + hygiene set for a site, in a stable order. */
export function buildLegalPages(ctx: LegalPageContext): LegalPage[] {
  return [
    buildPrivacyPolicy(ctx),
    buildTermsOfService(ctx),
    build404Page(),
  ];
}
