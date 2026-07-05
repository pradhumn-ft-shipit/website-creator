/**
 * Public surface of the intake module (012). The pipeline (009) imports the two
 * step bodies; the docs route imports the upload helper.
 */

export { runScrape, type ScrapeOutcome, type ScrapeReason } from "./scrape";
export { processIntake, type ProcessIntakeDeps } from "./extraction";
export {
  storeDocs,
  validateUpload,
  DOCS_BUCKET,
  MAX_DOC_BYTES,
  type UploadFileInput,
} from "./upload";
export { uploadDocsForUser, type UploadDocsDeps } from "./upload-service";
export {
  isContentSufficient,
  type SufficiencyVerdict,
  type InsufficientReason,
} from "./sufficiency";
export {
  detectFormat,
  isAcceptedFilename,
  extractDoc,
  ACCEPTED_DOC_FORMATS,
  type DocFormat,
} from "./docs";
export {
  roundOneSchema,
  ROUND_ONE_FIELDS,
  type RoundOneIntake,
  type IntakeField,
} from "./schema";

// 013 — intake confirm-or-correct + quick questions + Round-2 (§4.1.8/10/12).
export {
  deriveSubIndustry,
  mergeRoundOneCorrections,
  readIntakeForConfirm,
  saveQuickQuestions,
  saveRoundOneCorrections,
  saveRoundTwo,
  resolveAccountAndOrder,
  STATE_OVERLAYS,
  type ConfirmDeps,
  type ConfirmView,
  type AumBucket,
  type SubIndustry,
  type QuickQuestions,
  type RoundOneCorrection,
  type RoundTwoAnswers,
} from "./confirm";

// 013 — asset capture + logo processing (§4.1.11, §6.8).
export {
  uploadAssetsForUser,
  processLogo,
  detectLogoBackground,
  dominantColorHex,
  wordmarkFrom,
  LOGO_VARIANT_PLAN,
  ASSETS_BUCKET,
  type AssetDeps,
  type AssetFileInput,
  type AssetKind,
  type UploadedAsset,
  type LogoProcessing,
} from "./assets";

// 013 — template selection + build hand-off (§4.1.9/14, §6.1).
export {
  selectTemplate,
  finalizeAndBuild,
  isTemplateId,
  TEMPLATE_CATALOG,
  TEMPLATE_IDS,
  type TemplateId,
  type TemplateSpec,
  type BuildDeps,
  type BuildEventSender,
} from "./templates";
