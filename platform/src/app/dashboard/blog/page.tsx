import type { Metadata } from "next";

import { StubTab } from "@/components/dashboard/stub-tab";

export const metadata: Metadata = { title: "Blog · WRI" };

export default function BlogPage() {
  return <StubTab navKey="blog" />;
}
