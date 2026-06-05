"use client";

import { useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";

import { postJson } from "@/lib/api/client";
import { INDUSTRIES } from "@/lib/onboarding/steps";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Industry selection (§4.1 step 4, §2.2). Five cards: RIA proceeds; the other
 * four are not yet buildable and expand an inline waitlist capture (011) in
 * place — the advisor never leaves the flow.
 */
export function IndustryGrid({
  onPickRia,
  picking,
}: {
  onPickRia: () => void;
  picking: boolean;
}) {
  const [openWaitlist, setOpenWaitlist] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {INDUSTRIES.map((industry) => {
          const isOpen = openWaitlist === industry.key;
          return (
            <div key={industry.key} className="sm:[&:first-child]:col-span-2">
              <button
                type="button"
                disabled={picking}
                onClick={() =>
                  industry.live
                    ? onPickRia()
                    : setOpenWaitlist(isOpen ? null : industry.key)
                }
                aria-expanded={industry.live ? undefined : isOpen}
                className={cn(
                  "group flex w-full items-center justify-between rounded-2xl border bg-card p-5 text-left shadow-card transition-all duration-150 hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60",
                  industry.live && "border-primary/30",
                )}
              >
                <span>
                  <span className="block font-display text-lg tracking-tight">
                    {industry.label}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {industry.live
                      ? "Available now — let's build your site"
                      : "Coming soon — join the waitlist"}
                  </span>
                </span>
                <span
                  className={cn(
                    "ml-4 inline-flex size-9 shrink-0 items-center justify-center rounded-full",
                    industry.live
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                  aria-hidden
                >
                  {industry.live ? (
                    picking ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <ArrowRight />
                    )
                  ) : (
                    <span className="text-base leading-none">+</span>
                  )}
                </span>
              </button>

              {isOpen ? (
                <WaitlistCard industry={industry.key} label={industry.label} />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Inline email capture for a non-RIA card (ticket 011). No account required. */
function WaitlistCard({ industry, label }: { industry: string; label: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("submitting");
    setError(null);
    const res = await postJson("/api/waitlist", { email, industry });
    if (res.error) {
      setError(res.error.message);
      setState("error");
      return;
    }
    setState("done");
  }

  if (state === "done") {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-primary/30 bg-accent px-4 py-3 text-sm text-accent-foreground">
        <Check className="size-4 shrink-0" />
        You&apos;re on the {label} waitlist — we&apos;ll email you when it opens.
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mt-2 flex flex-col gap-2 rounded-xl border bg-muted/40 p-3 sm:flex-row"
    >
      <Input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@firm.com"
        aria-label={`Email for the ${label} waitlist`}
        className="bg-card"
      />
      <Button type="submit" disabled={state === "submitting"} className="shrink-0">
        {state === "submitting" ? "Joining…" : "Notify me"}
      </Button>
      {error ? (
        <p className="text-sm text-destructive sm:basis-full" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
