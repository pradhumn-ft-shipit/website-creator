import type { Metadata } from "next";

import { StubTab } from "@/components/dashboard/stub-tab";

export const metadata: Metadata = { title: "Assets · WRI" };

export default function AssetsPage() {
  return <StubTab navKey="assets" />;
}
