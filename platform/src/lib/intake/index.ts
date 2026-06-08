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
