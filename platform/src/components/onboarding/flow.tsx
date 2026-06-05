"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2, ShieldCheck, Sparkles } from "lucide-react";

import { postJson } from "@/lib/api/client";
import { RIA_SUB_CLASS, type StepKey } from "@/lib/onboarding/steps";
import { Button } from "@/components/ui/button";
import { ProgressRail } from "./progress-rail";
import { IndustryGrid } from "./industry-grid";

export type OnboardingFlowProps = {
  initialStep: StepKey;
  initialOrderId: string | null;
};

/**
 * Onboarding orchestrator (§4.1 steps 4–6, §7.7). Holds the current step, drives
 * Back/Next, and auto-saves each answer to the server before advancing — which
 * is what makes the flow resumable (the server resolves the resume step from the
 * persisted account, so a refresh re-enters here at the same place).
 *
 * Steps in this ticket: industry → sub-class → payment placeholder → handoff.
 * The post-payment pipeline questions (existing-site URL, quick questions,
 * template, copy review) are tickets 012/013/015/021 — they extend this shell.
 */
export function OnboardingFlow({ initialStep, initialOrderId }: OnboardingFlowProps) {
  const [step, setStep] = useState<StepKey>(initialStep);
  const [orderId, setOrderId] = useState<string | null>(initialOrderId);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-8">
      {step !== "handoff" ? (
        <header className="mb-10">
          <ProgressRail step={step} />
        </header>
      ) : null}

      <main className="flex flex-1 flex-col justify-center">
        {step === "industry" ? (
          <IndustryStep onNext={() => setStep("subclass")} />
        ) : null}
        {step === "subclass" ? (
          <SubClassStep
            onBack={() => setStep("industry")}
            onNext={() => setStep("payment")}
          />
        ) : null}
        {step === "payment" ? (
          <PaymentStep
            onBack={() => setStep("subclass")}
            onPaid={(id) => {
              setOrderId(id);
              setStep("handoff");
            }}
          />
        ) : null}
        {step === "handoff" ? <HandoffScreen orderId={orderId} /> : null}
      </main>
    </div>
  );
}

/** Wraps the grid; persists industry=ria before advancing. */
function IndustryStep({ onNext }: { onNext: () => void }) {
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickRia() {
    setPicking(true);
    setError(null);
    const res = await postJson("/api/onboarding/selection", { industry: "ria" });
    setPicking(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    onNext();
  }

  return (
    <section className="space-y-7">
      <StepHeading
        title="What kind of practice do you run?"
        subtitle="We're starting with Registered Investment Advisors. More industries are on the way."
      />
      <IndustryGrid onPickRia={pickRia} picking={picking} />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <SaveLater />
    </section>
  );
}

/** Sub-class confirm (§4.1 step 5) — RIA-only; SEC-vs-state resolved later. */
function SubClassStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setSubmitting(true);
    setError(null);
    const res = await postJson("/api/onboarding/selection", {
      subIndustry: RIA_SUB_CLASS,
    });
    setSubmitting(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    onNext();
  }

  return (
    <section className="space-y-7">
      <BackButton onBack={onBack} />
      <StepHeading
        title="You're a Registered Investment Advisor"
        subtitle="That's the only practice type we support today. We'll figure out SEC vs. state registration automatically from your AUM later — nothing to pick now."
      />
      <div className="flex items-start gap-3 rounded-2xl border bg-card p-5 shadow-card">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">
          Your site will be built against our RIA compliance ruleset and reviewed
          before it goes live.
        </p>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-between">
        <SaveLater />
        <Button onClick={confirm} disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : null}
          That&apos;s me — continue
        </Button>
      </div>
    </section>
  );
}

/** Payment placeholder (§15.4) — simulated; creates the order on confirm. */
function PaymentStep({
  onBack,
  onPaid,
}: {
  onBack: () => void;
  onPaid: (orderId: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startBuild() {
    setSubmitting(true);
    setError(null);
    const res = await postJson<{ orderId: string; created: boolean }>(
      "/api/onboarding/checkout",
      {},
    );
    if (res.error || !res.data) {
      setError(res.error?.message ?? "Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }
    onPaid(res.data.orderId);
  }

  return (
    <section className="space-y-7">
      <BackButton onBack={onBack} />
      <StepHeading
        title="Start your WRI subscription"
        subtitle="$50/month — your compliance-aware website, hosting, and unlimited edits."
      />

      <div className="rounded-2xl border bg-card p-6 shadow-card">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-2xl tracking-tight">$50</span>
          <span className="text-sm text-muted-foreground">per month</span>
        </div>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          {[
            "Custom, compliance-reviewed website",
            "Hosting + your own domain",
            "Edit anytime by chat — re-checked for compliance",
          ].map((line) => (
            <li key={line} className="flex items-center gap-2">
              <Check className="size-4 shrink-0 text-primary" aria-hidden />
              {line}
            </li>
          ))}
        </ul>
        <div className="mt-5 rounded-xl border border-primary/30 bg-accent px-4 py-3 text-sm text-accent-foreground">
          <strong className="font-semibold">Alpha access:</strong>{" "}
          no charge while we&apos;re in early access. You won&apos;t be billed today.
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-between">
        <SaveLater />
        <Button onClick={startBuild} disabled={submitting} size="lg">
          {submitting ? <Loader2 className="animate-spin" /> : <Sparkles />}
          Start my site
        </Button>
      </div>
    </section>
  );
}

/** Build handoff (§4.1 step 15). The pipeline (009) is running; advisor can leave. */
function HandoffScreen({ orderId }: { orderId: string | null }) {
  const router = useRouter();
  return (
    <section className="space-y-7 text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Sparkles className="size-7" aria-hidden />
      </div>
      <StepHeading
        center
        title="Your site is being built"
        subtitle="This takes about 15 minutes. You can close this tab — we'll email you the moment it's ready."
      />
      <div
        className="mx-auto flex max-w-sm items-center justify-center gap-2 rounded-full border bg-card px-4 py-2 text-sm text-muted-foreground shadow-card"
        aria-live="polite"
      >
        <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
        Preparing your website…
      </div>
      <div className="flex justify-center">
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          Go to dashboard
        </Button>
      </div>
      {orderId ? (
        <p className="text-xs text-muted-foreground">Order {orderId.slice(0, 8)}</p>
      ) : null}
    </section>
  );
}

// ---- shared bits ----------------------------------------------------------

function StepHeading({
  title,
  subtitle,
  center,
}: {
  title: string;
  subtitle: string;
  center?: boolean;
}) {
  return (
    <div className={center ? "space-y-3 text-center" : "space-y-3"}>
      <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground">
        {title}
      </h1>
      <p className="text-base text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Back
    </button>
  );
}

/**
 * "Save & continue later" (§7.7). Every step already auto-saves to the account,
 * so the advisor can leave and return to /onboarding to resume exactly here. The
 * emailed magic-link delivery of that resume URL lands with Resend (ticket 004);
 * until then this is a reassurance + safe exit for an already-signed-in advisor.
 */
function SaveLater() {
  const router = useRouter();
  const [saved, setSaved] = useState(false);

  if (saved) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <Check className="size-4 text-primary" aria-hidden />
        Saved — pick up anytime
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setSaved(true);
        // Give the advisor a beat to see the confirmation, then exit safely.
        setTimeout(() => router.push("/dashboard"), 900);
      }}
      className="text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
    >
      Save &amp; continue later
    </button>
  );
}
