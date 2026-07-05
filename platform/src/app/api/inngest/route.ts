/**
 * Inngest serve endpoint (PRD §9.2). `npx inngest-cli dev` discovers the
 * pipeline functions here. The Next.js API only registers/serves functions;
 * actual long work runs inside Inngest steps.
 */
import { serve } from "inngest/next";

import { inngest } from "@/lib/inngest/client";
import { generationPipeline } from "@/lib/inngest/pipeline";
import { complianceRevalidation, complianceWeeklyScan } from "@/lib/inngest/compliance";

export const runtime = "nodejs";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generationPipeline, complianceRevalidation, complianceWeeklyScan],
});
