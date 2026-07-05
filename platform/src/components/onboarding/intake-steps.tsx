"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Check, Loader2, Sparkles, UploadCloud } from "lucide-react";

import { postJson } from "@/lib/api/client";
import type { ApiEnvelope } from "@/lib/api/envelope";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StepHeading, BackButton } from "./flow";

/**
 * Intake sub-flow (PRD §4.1 steps 8, 10–12 + step 9 template · §5.5 · §6.8 ·
 * §8.3). Five screens with their own progress rail, run after the order is
 * created at checkout: quick questions → Round-1 confirm-or-correct → asset
 * upload → Round-2 → template. The last screen's "Build my site" starts the
 * pipeline (the enqueue moved off payment — see templates.ts#finalizeAndBuild).
 *
 * Each screen auto-saves to its endpoint before advancing (§7.7). The confirm
 * and template screens read the extracted blob (012) via GET /api/onboarding/
 * intake — confirm-or-correct shows "We think X", never blank fields, and the
 * template previews are tinted with the extracted brand colour.
 */

const SUB_STEPS = ["quick", "confirm", "assets", "round2", "template"] as const;
type SubStep = (typeof SUB_STEPS)[number];

const STATE_OPTIONS = ["CA", "NY", "TX", "FL", "IL", "PA", "NJ", "MA", "GA", "OH"] as const;
const CUSTODIANS = ["Schwab", "Fidelity", "Altruist", "Pershing", "Other"] as const;
const DESIGNATIONS = ["CFP®", "CFA", "ChFC", "CPA/PFS", "Other"] as const;

/** Client-safe mirror of the §6.1 catalog (the authoritative one is templates.ts). */
const TEMPLATES = [
  {
    id: "trust",
    name: "Trust",
    persona: "Older, conservative advisors; legacy practices.",
    aesthetic: "Serif headings, navy/charcoal, advisor-photo hero, credentials-heavy.",
    accentDefault: "#2B3A4D",
    heading: "serif" as const,
  },
  {
    id: "modern",
    name: "Modern",
    persona: "Gen X / NextGen-focused advisors.",
    aesthetic: "Sans-serif, generous whitespace, big imagery, short copy blocks.",
    accentDefault: "#1F6F52",
    heading: "sans" as const,
  },
  {
    id: "boutique",
    name: "Boutique",
    persona: "Content-producing advisors, RIAs targeting professionals.",
    aesthetic: "Magazine-style, mixed serif/sans, photography-forward, blog-prominent.",
    accentDefault: "#7A4BD0",
    heading: "mixed" as const,
  },
] as const;
type TemplateId = (typeof TEMPLATES)[number]["id"];

// ---- shared types ---------------------------------------------------------

interface IntakeFieldView {
  value: unknown;
  confidence: number;
  sources: string[];
}
interface ConfirmView {
  intake: Record<string, IntakeFieldView | undefined> & { brandColors?: IntakeFieldView };
  firmName: string | null;
}

async function getJson<T>(path: string): Promise<ApiEnvelope<T>> {
  try {
    const res = await fetch(path, { headers: { Accept: "application/json" } });
    return (await res.json()) as ApiEnvelope<T>;
  } catch {
    return { data: null, error: { message: "Couldn't reach the server.", code: "network_error" } };
  }
}

// ---- orchestrator ---------------------------------------------------------

export function IntakeFlow({ onComplete }: { onComplete: () => void }) {
  const [sub, setSub] = useState<SubStep>("quick");
  const [view, setView] = useState<ConfirmView | null>(null);
  const [needsState, setNeedsState] = useState(false);

  // Load the extracted blob once — feeds confirm-or-correct + the brand-colour
  // template previews. A miss is non-fatal: the confirm screen just shows empty
  // rows the advisor fills.
  useEffect(() => {
    let alive = true;
    getJson<ConfirmView>("/api/onboarding/intake").then((res) => {
      if (alive && res.data) setView(res.data);
    });
    return () => {
      alive = false;
    };
  }, []);

  const index = SUB_STEPS.indexOf(sub);
  const brandColor = firstBrandColor(view);

  return (
    <section className="w-full">
      <header className="mb-8">
        <IntakeRail current={index + 1} total={SUB_STEPS.length} />
      </header>

      {sub === "quick" ? (
        <QuickStep
          needsState={needsState}
          onAumChange={(bucket) => setNeedsState(bucket === "under_100m")}
          onNext={() => setSub("confirm")}
        />
      ) : null}
      {sub === "confirm" ? (
        <ConfirmStep view={view} onBack={() => setSub("quick")} onNext={() => setSub("assets")} />
      ) : null}
      {sub === "assets" ? (
        <AssetsStep firmName={view?.firmName ?? null} onBack={() => setSub("confirm")} onNext={() => setSub("round2")} />
      ) : null}
      {sub === "round2" ? (
        <RoundTwoStep onBack={() => setSub("assets")} onNext={() => setSub("template")} />
      ) : null}
      {sub === "template" ? (
        <TemplateStep brandColor={brandColor} onBack={() => setSub("round2")} onComplete={onComplete} />
      ) : null}
    </section>
  );
}

function IntakeRail({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span className="font-display text-sm tracking-tight text-foreground">Set up your site</span>
        <span aria-live="polite">
          Step {current} of {total}
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label={`Setup progress: step ${current} of ${total}`}
      >
        <div className="h-full rounded-full bg-primary transition-all duration-500 ease-out" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ---- step 1: quick questions (§4.1.8, §5.5) -------------------------------

function QuickStep({
  needsState,
  onAumChange,
  onNext,
}: {
  needsState: boolean;
  onAumChange: (b: "under_100m" | "over_100m") => void;
  onNext: () => void;
}) {
  const [aum, setAum] = useState<"under_100m" | "over_100m">("over_100m");
  const [primaryState, setPrimaryState] = useState("CA");
  const [crdNumber, setCrdNumber] = useState("");
  const [custodian, setCustodian] = useState<string>("Schwab");
  const [designations, setDesignations] = useState<string[]>(["CFP®"]);
  const { busy, error, run } = useSubmit();

  function pickAum(b: "under_100m" | "over_100m") {
    setAum(b);
    onAumChange(b);
  }

  async function submit() {
    await run(
      () =>
        postJson("/api/onboarding/intake", {
          kind: "quick",
          aumBucket: aum,
          primaryState: aum === "under_100m" ? primaryState : undefined,
          crdNumber: crdNumber || undefined,
          custodian,
          designations,
        }),
      onNext,
    );
  }

  return (
    <div className="space-y-7">
      <StepHeading
        title="Let's confirm your registration"
        subtitle="A few things a website can't tell us. Takes about a minute — you can change any of it later."
      />

      <Field label="Assets under management (AUM)" help="This sets whether you're SEC- or state-registered.">
        <Segmented
          ariaLabel="Assets under management"
          options={[
            { value: "under_100m", label: "Under $100M" },
            { value: "over_100m", label: "$100M or more" },
          ]}
          value={aum}
          onChange={(v) => pickAum(v as "under_100m" | "over_100m")}
        />
      </Field>

      {needsState ? (
        <Field label="Primary state of registration" help="We apply your state's disclosure overlay.">
          <select
            aria-label="Primary state of registration"
            value={primaryState}
            onChange={(e) => setPrimaryState(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-input bg-card px-3.5 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            {STATE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <Field label="CRD number" help="Optional — unlocks auto-fill from IAPD.">
        <Input aria-label="CRD number" value={crdNumber} onChange={(e) => setCrdNumber(e.target.value)} placeholder="e.g. 123456" />
      </Field>

      <Field label="Custodian">
        <Pills single options={[...CUSTODIANS]} selected={[custodian]} onToggle={(v) => setCustodian(v)} />
      </Field>

      <Field label="Designations of principals">
        <Pills
          options={[...DESIGNATIONS]}
          selected={designations}
          onToggle={(v) => setDesignations((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]))}
        />
      </Field>

      <NavRow error={error} onBack={undefined} busy={busy} onNext={submit} nextLabel="Next" />
    </div>
  );
}

// ---- step 2: Round-1 confirm-or-correct (§4.1.10, §8.3) -------------------

const CONFIRM_FIELDS: { key: string; label: string; kind: "text" | "number" | "list" }[] = [
  { key: "firmName", label: "Firm name", kind: "text" },
  { key: "yearFounded", label: "Year founded", kind: "number" },
  { key: "teamSize", label: "Team size", kind: "number" },
  { key: "primaryServices", label: "Primary services", kind: "list" },
  { key: "idealClientPersona", label: "Ideal client", kind: "text" },
  { key: "feeStructure", label: "Fee structure", kind: "text" },
];

function ConfirmStep({ view, onBack, onNext }: { view: ConfirmView | null; onBack: () => void; onNext: () => void }) {
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();

  function currentValue(key: string): string {
    if (key in edits) return edits[key];
    const field = view?.intake?.[key];
    const v = field?.value;
    if (Array.isArray(v)) return v.join(", ");
    return v == null ? "" : String(v);
  }

  async function submit() {
    const corrections = Object.entries(edits).map(([field, raw]) => {
      const meta = CONFIRM_FIELDS.find((f) => f.key === field);
      let value: unknown = raw;
      if (meta?.kind === "number") value = Number(raw) || null;
      if (meta?.kind === "list") value = raw.split(",").map((s) => s.trim()).filter(Boolean);
      return { field, value };
    });
    await run(() => postJson("/api/onboarding/intake", { kind: "corrections", corrections }), onNext);
  }

  return (
    <div className="space-y-7">
      <StepHeading
        title="Here's what we picked up"
        subtitle="Everything's editable — confirm what's right, fix what's off. Green means we're confident."
      />

      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        {CONFIRM_FIELDS.map((f) => {
          const field = view?.intake?.[f.key];
          const conf = field?.confidence ?? 0;
          const isEditing = editing === f.key;
          const display = currentValue(f.key) || "Not found";
          return (
            <div key={f.key} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
              <span className="w-28 shrink-0 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{f.label}</span>
              <div className="flex-1">
                {isEditing ? (
                  <Input
                    aria-label={f.label}
                    autoFocus
                    value={currentValue(f.key)}
                    onChange={(e) => setEdits((cur) => ({ ...cur, [f.key]: e.target.value }))}
                  />
                ) : (
                  <span className="text-sm">{display}</span>
                )}
              </div>
              <ConfidenceChip confidence={conf} hasValue={Boolean(currentValue(f.key))} edited={f.key in edits} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditing(isEditing ? null : f.key)}
              >
                {isEditing ? "Done" : currentValue(f.key) ? "Edit" : "Add"}
              </Button>
            </div>
          );
        })}
      </div>

      <NavRow error={error} onBack={onBack} busy={busy} onNext={submit} nextLabel="Looks right — continue" />
    </div>
  );
}

function ConfidenceChip({ confidence, hasValue, edited }: { confidence: number; hasValue: boolean; edited: boolean }) {
  if (edited) return <Chip tone="ok">Confirmed</Chip>;
  if (!hasValue) return <Chip tone="gap">Missing</Chip>;
  if (confidence >= 0.85) return <Chip tone="ok">{confidence.toFixed(2)}</Chip>;
  return <Chip tone="low">Check</Chip>;
}

// ---- step 3: assets (§4.1.11, §6.8) ---------------------------------------

function AssetsStep({ firmName, onBack, onNext }: { firmName: string | null; onBack: () => void; onNext: () => void }) {
  const [logo, setLogo] = useState<File | null>(null);
  const [team, setTeam] = useState<File[]>([]);
  const [office, setOffice] = useState<File[]>([]);
  const { busy, error, run } = useSubmit();
  const hasFiles = Boolean(logo) || team.length > 0 || office.length > 0;

  async function submit() {
    if (!hasFiles) {
      onNext();
      return;
    }
    const form = new FormData();
    if (logo) {
      form.append("files", logo);
      form.append("kind", "logo");
      form.append("name", "");
      form.append("title", "");
    }
    for (const f of team) {
      form.append("files", f);
      form.append("kind", "team_photo");
      form.append("name", "");
      form.append("title", "");
    }
    for (const f of office) {
      form.append("files", f);
      form.append("kind", "office");
      form.append("name", "");
      form.append("title", "");
    }
    await run(async () => {
      try {
        const res = await fetch("/api/onboarding/assets", { method: "POST", body: form });
        return (await res.json()) as ApiEnvelope<unknown>;
      } catch {
        return { data: null, error: { message: "Upload failed.", code: "network_error" } };
      }
    }, onNext);
  }

  return (
    <div className="space-y-7">
      <StepHeading
        title="Add your logo & photos"
        subtitle="All optional — anything you skip, we handle. No logo? We'll set a clean wordmark from your firm name."
      />

      <Dropzone label="Logo" accept=".png,.svg,.jpg,.jpeg" ariaLabel="Upload logo" onFiles={(f) => setLogo(f[0] ?? null)} chosen={logo ? [logo.name] : []} />
      {!logo && firmName ? (
        <div className="rounded-2xl border bg-card p-5 text-center shadow-card">
          <p className="font-display text-2xl tracking-tight">{firmName}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Wordmark preview — used if no logo</p>
        </div>
      ) : null}

      <Dropzone label="Team photos" accept="image/*" multiple ariaLabel="Upload team photos" onFiles={(f) => setTeam(f)} chosen={team.map((f) => f.name)} />
      <Dropzone label="Office photos (optional)" accept="image/*" multiple ariaLabel="Upload office photos" onFiles={(f) => setOffice(f)} chosen={office.map((f) => f.name)} />

      <NavRow error={error} onBack={onBack} busy={busy} onNext={submit} nextLabel={hasFiles ? "Upload & continue" : "Skip — I'll add later"} />
    </div>
  );
}

// ---- step 4: Round-2 (§4.1.12, §8.3) --------------------------------------

function RoundTwoStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({ photosPreference: "own", blog: true, displayFees: false, logoBackground: "light" });
  const { busy, error, run } = useSubmit();
  const set = (k: string, v: unknown) => setAnswers((cur) => ({ ...cur, [k]: v }));

  async function submit() {
    await run(() => postJson("/api/onboarding/intake", { kind: "round2", answers }), onNext);
  }

  return (
    <div className="space-y-6">
      <StepHeading title="What makes you, you" subtitle="Short answers are fine. These shape your copy — we never guess them." />

      <Field label="What makes you different?">
        <Input aria-label="What makes you different?" onChange={(e) => set("differentiator", e.target.value)} placeholder="One sentence" />
      </Field>
      <Field label="Who do you serve best?">
        <Input aria-label="Who do you serve best?" onChange={(e) => set("servesBest", e.target.value)} placeholder="One sentence" />
      </Field>
      <Field label="One client story to highlight" help="We'll anonymize it.">
        <textarea
          aria-label="One client story to highlight"
          onChange={(e) => set("clientStory", e.target.value)}
          rows={2}
          className="flex w-full rounded-lg border border-input bg-card px-3.5 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        />
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Blog?">
          <Segmented ariaLabel="Blog" options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} value={answers.blog ? "yes" : "no"} onChange={(v) => set("blog", v === "yes")} />
        </Field>
        <Field label="Display your fees?">
          <Segmented ariaLabel="Display fees" options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} value={answers.displayFees ? "yes" : "no"} onChange={(v) => set("displayFees", v === "yes")} />
        </Field>
        <Field label="Logo background">
          <Segmented ariaLabel="Logo background" options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} value={String(answers.logoBackground)} onChange={(v) => set("logoBackground", v)} />
        </Field>
        <Field label="Photos">
          <Segmented ariaLabel="Photos preference" options={[{ value: "own", label: "My own" }, { value: "stock", label: "Stock" }]} value={String(answers.photosPreference)} onChange={(v) => set("photosPreference", v)} />
        </Field>
      </div>

      <Field label="Custodian portal URL" help="If you want a 'Client Login' button.">
        <Input aria-label="Custodian portal URL" onChange={(e) => set("custodianPortalUrl", e.target.value)} placeholder="https://…" />
      </Field>

      <NavRow error={error} onBack={onBack} busy={busy} onNext={submit} nextLabel="Continue" />
    </div>
  );
}

// ---- step 5: template (§4.1.9, §6.1) --------------------------------------

function TemplateStep({ brandColor, onBack, onComplete }: { brandColor: string | null; onBack: () => void; onComplete: () => void }) {
  const [selected, setSelected] = useState<TemplateId | null>(null);
  const { busy, error, run } = useSubmit();

  async function build() {
    if (!selected) return;
    await run(async () => {
      const pick = await postJson("/api/onboarding/template", { templateId: selected });
      if (pick.error) return pick;
      return postJson("/api/onboarding/template", { action: "build" });
    }, onComplete);
  }

  return (
    <div className="space-y-7">
      <StepHeading title="Pick your template" subtitle="Each is previewed in your brand colour. You can't switch after your site is built, so take a look." />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-accent px-3 py-2 text-xs text-accent-foreground">
        <span className="inline-block size-4 rounded" style={{ background: brandColor ?? "#1F6F52" }} aria-hidden />
        {brandColor ? `Previewing with your brand colour ${brandColor}` : "No brand colour found — using a sensible default"}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" role="radiogroup" aria-label="Template">
        {TEMPLATES.map((t) => {
          const accent = brandColor ?? t.accentDefault;
          const isSel = selected === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={isSel}
              aria-label={`${t.name} template`}
              onClick={() => setSelected(t.id)}
              className={`overflow-hidden rounded-xl border bg-card text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isSel ? "border-primary ring-2 ring-accent" : "hover:shadow-card"
              }`}
            >
              <div className="border-b p-3">
                <div className="mb-2 h-8 rounded" style={{ background: accent }} aria-hidden />
                <div className="h-1.5 w-4/5 rounded bg-muted" />
                <div className="mt-1 h-1.5 w-3/5 rounded bg-muted" />
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{t.name}</span>
                  {isSel ? <Check className="size-4 text-primary" aria-hidden /> : null}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{t.persona}</p>
                <p className="mt-2 border-t pt-2 text-[11px] text-muted-foreground">{t.aesthetic}</p>
              </div>
            </button>
          );
        })}
      </div>

      <NavRow error={error} onBack={onBack} busy={busy} onNext={build} nextLabel="Build my site" nextDisabled={!selected} nextIcon="build" />
    </div>
  );
}

// ---- shared bits ----------------------------------------------------------

function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(action: () => Promise<ApiEnvelope<unknown>>, onDone: () => void) {
    setBusy(true);
    setError(null);
    const res = await action();
    setBusy(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    onDone();
  }
  return { busy, error, run };
}

function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
      {help ? <p className="text-xs text-muted-foreground">{help}</p> : null}
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            i > 0 ? "border-l" : ""
          } ${value === o.value ? "bg-primary text-primary-foreground" : "bg-card text-foreground"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Pills({
  options,
  selected,
  onToggle,
  single,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  single?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2" role={single ? "radiogroup" : "group"}>
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            role={single ? "radio" : "checkbox"}
            aria-checked={on}
            onClick={() => onToggle(o)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              on ? "border-primary/40 bg-accent text-accent-foreground" : "border-input bg-card text-muted-foreground"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function Chip({ tone, children }: { tone: "ok" | "low" | "gap"; children: ReactNode }) {
  const cls =
    tone === "ok"
      ? "bg-accent text-accent-foreground"
      : tone === "low"
        ? "bg-warning/15 text-warning"
        : "bg-destructive/10 text-destructive";
  return <span className={`shrink-0 rounded-full px-2 py-1 font-mono text-[10px] ${cls}`}>{children}</span>;
}

function Dropzone({
  label,
  accept,
  multiple,
  onFiles,
  chosen,
  ariaLabel,
}: {
  label: string;
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  chosen: string[];
  ariaLabel: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-input bg-card px-4 py-4 text-sm text-muted-foreground transition-colors hover:border-ring">
        <UploadCloud className="size-5 shrink-0 opacity-60" aria-hidden />
        <span>{chosen.length ? chosen.join(", ") : "Drop a file or browse"}</span>
        <input
          type="file"
          aria-label={ariaLabel}
          accept={accept}
          multiple={multiple}
          className="sr-only"
          onChange={(e) => onFiles(Array.from(e.target.files ?? []))}
        />
      </label>
    </div>
  );
}

function NavRow({
  error,
  onBack,
  busy,
  onNext,
  nextLabel,
  nextDisabled,
  nextIcon,
}: {
  error: string | null;
  onBack?: () => void;
  busy: boolean;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
  nextIcon?: "build";
}) {
  return (
    <div className="space-y-3">
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-between">
        {onBack ? <BackButton onBack={onBack} /> : <span />}
        <Button onClick={onNext} disabled={busy || nextDisabled}>
          {busy ? <Loader2 className="animate-spin" /> : nextIcon === "build" ? <Sparkles /> : null}
          {nextLabel}
          {!busy && !nextIcon ? <ArrowRight /> : null}
        </Button>
      </div>
    </div>
  );
}

function firstBrandColor(view: ConfirmView | null): string | null {
  const raw = view?.intake?.brandColors?.value;
  const first = Array.isArray(raw) ? raw.find((c) => typeof c === "string" && /^#?[0-9a-fA-F]{6}$/.test(c)) : null;
  if (!first) return null;
  return (first as string).startsWith("#") ? (first as string).toUpperCase() : `#${(first as string).toUpperCase()}`;
}
