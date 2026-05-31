import type { Metadata } from "next";

import { StubTab } from "@/components/dashboard/stub-tab";

export const metadata: Metadata = { title: "Team · WRI" };

export default function TeamPage() {
  return <StubTab navKey="team" />;
}
