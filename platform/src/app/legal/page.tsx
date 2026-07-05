import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { LEGAL_DOCUMENTS } from "@/lib/legal/content";

export const metadata: Metadata = {
  title: "Legal — WRI",
  description: "WRI's Terms of Service, Privacy Policy, and Data Processing Agreement.",
};

export default function LegalIndexPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-16">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Legal</h1>
      <p className="text-muted-foreground mt-3 text-base">
        WRI&apos;s platform-side legal documents. These govern the WRI service itself —
        for the legal content that ships on your generated website (its own privacy
        policy and disclaimer), see your dashboard.
      </p>
      <div className="mt-8 flex flex-col gap-4">
        {LEGAL_DOCUMENTS.map((doc) => (
          <Link key={doc.slug} href={`/legal/${doc.slug}`} className="group">
            <Card className="transition-shadow group-hover:shadow-md">
              <CardContent className="flex items-center justify-between gap-4 p-5">
                <div>
                  <CardTitle>{doc.title}</CardTitle>
                  <CardDescription className="mt-1">{doc.summary}</CardDescription>
                </div>
                <ArrowRight
                  className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
