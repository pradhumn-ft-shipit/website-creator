import type { Metadata } from "next";

import { LegalDocumentView } from "@/components/legal/legal-document-view";
import { PRIVACY_POLICY } from "@/lib/legal/content";

export const metadata: Metadata = {
  title: "Privacy Policy — WRI",
  description: PRIVACY_POLICY.summary,
};

export default function PrivacyPolicyPage() {
  return <LegalDocumentView document={PRIVACY_POLICY} />;
}
