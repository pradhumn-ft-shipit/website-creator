/**
 * Public surface of the prompts module — what generation (020), edit chat (029),
 * Layer-2 (006), and blog-check (031) import. The versioned output schema and
 * the prompt loader live behind this one entry point.
 */

export {
  loadPrompt,
  assemblePrompt,
  parsePromptFile,
  PROMPT_VERSION,
  PROMPT_NAMES,
  type PromptName,
  type LoadedPrompt,
} from "./loader";

export {
  GENERATED_SITE_SCHEMA,
  SCHEMA_VERSION,
  type GeneratedSite,
  type GeneratedPage,
  type GeneratedSection,
  type GeneratedField,
  type FooterLink,
  type FooterLinkKind,
} from "./schema";
