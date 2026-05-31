import type { Metadata } from "next";

import { StubTab } from "@/components/dashboard/stub-tab";

export const metadata: Metadata = { title: "Edit Site · WRI" };

export default function EditSitePage() {
  return <StubTab navKey="edit" />;
}
