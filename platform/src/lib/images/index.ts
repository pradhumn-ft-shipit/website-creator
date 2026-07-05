/**
 * Public surface of the site-images module (022). The pipeline (009) imports the
 * `runImagesStep` body; the build step (024) reads the manifest + slot set + the
 * STOCK_PHOTO_CREDITS.md content.
 */

export {
  runImagesStep,
  advisorSlotsFromAssets,
  buildAssetStoragePath,
  extForMime,
  SITE_ASSETS_BUCKET,
  IMAGE_MANIFEST_PAGE,
  SITE_IMAGE_SLOTS,
  type RunImagesStepDeps,
} from "./service";

export {
  resolveSiteImages,
  type ImageManifest,
  type ResolvedImage,
  type ResolveSiteImagesDeps,
  type AssetStore,
} from "./resolve";

export {
  planImageResolution,
  type ImageSlot,
  type SlotPlan,
  type SlotSource,
  type AiSubject,
} from "./slots";

export {
  assertImagePromptAllowed,
  isProhibitedImageSubject,
  ProhibitedImageSubjectError,
} from "./guard";

export { buildImagePrompt, generateAiImage, type AiImage } from "./ai";

export {
  searchStock,
  fetchImageBytes,
  type StockCandidate,
} from "./stock";

export {
  buildStockCreditsMarkdown,
  STOCK_CREDITS_FILENAME,
  type StockCreditEntry,
  type StockProvider,
} from "./credits";
