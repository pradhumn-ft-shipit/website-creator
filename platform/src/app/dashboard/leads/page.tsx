import type { Metadata } from "next";

import { StubTab } from "@/components/dashboard/stub-tab";

export const metadata: Metadata = { title: "Leads · WRI" };

export default function LeadsPage() {
  return <StubTab navKey="leads" />;
}
