import type { Metadata } from "next";

import { StubTab } from "@/components/dashboard/stub-tab";

export const metadata: Metadata = { title: "Billing · WRI" };

export default function BillingPage() {
  return <StubTab navKey="billing" />;
}
