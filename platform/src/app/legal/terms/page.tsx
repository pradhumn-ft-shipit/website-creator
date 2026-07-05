import type { Metadata } from "next";

import { LegalDocumentView } from "@/components/legal/legal-document-view";
import { TERMS_OF_SERVICE } from "@/lib/legal/content";

export const metadata: Metadata = {
  title: "Terms of Service — WRI",
  description: TERMS_OF_SERVICE.summary,
};

export default function TermsOfServicePage() {
  return <LegalDocumentView document={TERMS_OF_SERVICE} />;
}
