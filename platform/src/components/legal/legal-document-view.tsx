import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  EFFECTIVE_DATE_LABEL,
  LEGAL_DOCUMENTS,
  LEGAL_REVIEW_NOTE,
  LEGAL_REVIEW_PENDING,
  type LegalDocument,
  type LegalListItem,
} from "@/lib/legal/content";
import { cn } from "@/lib/utils";

function isListItem(item: string | LegalListItem): item is LegalListItem {
  return typeof item !== "string";
}

/**
 * Shared renderer for all three WRI legal pages (ToS, Privacy, DPA). Pages
 * under src/app/legal/* are thin — they resolve a `LegalDocument` from
 * `lib/legal/content.ts` and hand it here. Keeping the review-pending banner
 * and cross-document nav in one place means a single spot to flip once
 * counsel review lands (`LEGAL_REVIEW_PENDING` in lib/legal/content.ts).
 */
export function LegalDocumentView({ document }: { document: LegalDocument }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-16">
      <nav aria-label="Legal documents" className="mb-8 flex flex-wrap gap-2">
        {LEGAL_DOCUMENTS.map((doc) => (
          <Link
            key={doc.slug}
            href={`/legal/${doc.slug}`}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              doc.slug === document.slug
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
            aria-current={doc.slug === document.slug ? "page" : undefined}
          >
            {doc.shortName}
          </Link>
        ))}
      </nav>

      {LEGAL_REVIEW_PENDING && (
        <Card
          tone="danger"
          data-testid="legal-review-pending-banner"
          className="mb-8 border-warning/40 bg-warning/10"
        >
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle
              className="text-warning mt-0.5 size-4 shrink-0"
              aria-hidden
            />
            <div>
              <p className="text-foreground text-sm font-semibold">
                Draft — pending counsel review
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {LEGAL_REVIEW_NOTE}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mb-2 flex items-center gap-2">
        <Badge variant="neutral">{EFFECTIVE_DATE_LABEL}</Badge>
      </div>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {document.title}
      </h1>
      <p className="text-muted-foreground mt-3 max-w-xl text-base">
        {document.summary}
      </p>

      <div className="mt-10 flex flex-col gap-10">
        {document.sections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-8">
            <h2 className="text-xl font-semibold tracking-tight">
              {section.heading}
            </h2>
            {section.paragraphs?.map((paragraph, idx) => (
              <p key={idx} className="text-foreground/90 mt-3 text-sm leading-relaxed">
                {paragraph}
              </p>
            ))}
            {section.list && (
              <ul className="mt-3 flex flex-col gap-2">
                {section.list.map((item, idx) => (
                  <li
                    key={idx}
                    className="text-foreground/90 flex gap-2 text-sm leading-relaxed"
                  >
                    <span className="text-muted-foreground" aria-hidden>
                      —
                    </span>
                    <span>
                      {isListItem(item) ? (
                        <>
                          <span className="font-medium">{item.term}:</span>{" "}
                          {item.text}
                        </>
                      ) : (
                        item
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
