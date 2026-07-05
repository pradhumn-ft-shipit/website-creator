import type { Metadata } from "next";

import { LegalDocumentView } from "@/components/legal/legal-document-view";
import { DPA_TEMPLATE } from "@/lib/legal/content";

export const metadata: Metadata = {
  title: "Data Processing Agreement — WRI",
  description: DPA_TEMPLATE.summary,
};

export default function DpaPage() {
  return <LegalDocumentView document={DPA_TEMPLATE} />;
}
