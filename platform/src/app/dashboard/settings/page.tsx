import type { Metadata } from "next";

import { StubTab } from "@/components/dashboard/stub-tab";

export const metadata: Metadata = { title: "Settings · WRI" };

// Settings is delivered by the second slice of ticket 027; until then it shows
// the designed coming-soon placeholder rather than a half-built screen (§7.10).
export default function SettingsPage() {
  return <StubTab navKey="settings" />;
}
