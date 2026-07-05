/**
 * Public surface of the generated-site legal-pages module (022). The pipeline
 * (009) runs `generateLegalPages`; the build step (024) reads the persisted
 * `generated_content` rows (page = privacy|terms|not-found).
 */

export {
  generateLegalPages,
  validateLegalPages,
  legalContextFromAccount,
  LEGAL_SECTION,
  type GenerateLegalPagesDeps,
  type LegalPagesResult,
  type LegalPageValidation,
} from "./service";

export {
  buildLegalPages,
  buildPrivacyPolicy,
  buildTermsOfService,
  build404Page,
  type LegalPage,
  type LegalPageContext,
  type LegalSlug,
  type LegalPageContent,
  type DocumentSection,
} from "./templates";
