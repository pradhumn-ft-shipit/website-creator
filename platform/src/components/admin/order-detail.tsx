import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
  FileText,
  Rocket,
  ShieldAlert,
  Workflow,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { OrderActions } from "@/components/admin/order-actions";
import {
  formatDuration,
  type AdminOrderDetail,
  type ContentPiece,
  type DeploymentLog,
  type StateHistoryEntry,
  type StateTone,
  type ViolationSummary,
} from "@/lib/admin/orders";

const TONE_VARIANT: Record<StateTone, "neutral" | "warning" | "success" | "destructive"> = {
  neutral: "neutral",
  info: "neutral",
  warning: "warning",
  success: "success",
  danger: "destructive",
};

const SEVERITY_VARIANT: Record<string, "neutral" | "warning" | "destructive"> = {
  low: "neutral",
  medium: "warning",
  high: "destructive",
};

function dateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** A labelled section: an icon + title heading above a card. */
function Section({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
        <Icon className="text-muted-foreground size-4" aria-hidden />
        {title}
        {count !== undefined ? (
          <span className="text-muted-foreground font-normal">({count})</span>
        ) : null}
      </h2>
      {children}
    </section>
  );
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="text-muted-foreground p-6 text-sm">{children}</Card>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

// ---- sections ------------------------------------------------------------

function StateHistory({ history }: { history: StateHistoryEntry[] }) {
  return (
    <Card className="p-5">
      <ol className="flex flex-col">
        {history.map((entry, i) => (
          <li key={`${entry.status}-${entry.enteredAt}-${i}`} className="flex gap-3">
            {/* rail: dot + connector */}
            <div className="flex flex-col items-center">
              {entry.isCurrent ? (
                <CircleDashed className="text-primary size-4" aria-hidden />
              ) : (
                <CheckCircle2 className="text-muted-foreground/50 size-4" aria-hidden />
              )}
              {i < history.length - 1 ? (
                <span className="bg-border w-px flex-1" aria-hidden />
              ) : null}
            </div>
            <div className={i < history.length - 1 ? "pb-5" : ""}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={TONE_VARIANT[entry.tone]}>{entry.label}</Badge>
                {entry.isCurrent ? (
                  <span className="text-muted-foreground text-xs">current</span>
                ) : null}
                {entry.note ? (
                  <span className="text-muted-foreground text-xs italic">
                    {entry.note}
                  </span>
                ) : null}
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                {dateTime(entry.enteredAt)} · {formatDuration(entry.durationMs)}
                {entry.isCurrent ? " in state" : ""}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function ContentTable({ content }: { content: ContentPiece[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Generated content versions</caption>
          <thead className="bg-muted/50 text-muted-foreground text-xs">
            <tr className="text-left">
              <th scope="col" className="px-4 py-2.5 font-medium">Page</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Section</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Ver.</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Confidence</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Ruleset</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {content.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2.5 font-medium">{c.page}</td>
                <td className="text-muted-foreground px-4 py-2.5">{c.section ?? "—"}</td>
                <td className="text-muted-foreground px-4 py-2.5">v{c.version}</td>
                <td className="text-muted-foreground px-4 py-2.5">
                  {c.confidenceScore != null ? c.confidenceScore.toFixed(2) : "—"}
                </td>
                <td className="text-muted-foreground px-4 py-2.5">
                  {c.complianceVersionUsed ?? "—"}
                </td>
                <td className="px-4 py-2.5">
                  <Badge variant={c.approved ? "success" : "neutral"}>
                    {c.approved ? "Approved" : "Draft"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ViolationsList({ violations }: { violations: ViolationSummary[] }) {
  return (
    <div className="flex flex-col gap-2">
      {violations.map((v) => (
        <Card key={v.id} className="flex flex-wrap items-center gap-3 p-4">
          <Badge variant={SEVERITY_VARIANT[v.severity ?? ""] ?? "neutral"}>
            {v.severity ?? "unknown"}
          </Badge>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{v.description ?? "—"}</p>
            <p className="text-muted-foreground text-xs">
              {v.fieldPath ?? "—"}
              {v.rulesetVersion ? ` · ${v.rulesetVersion}` : ""}
            </p>
          </div>
          <Badge variant={v.resolved ? "success" : "warning"}>
            {v.resolved ? `Resolved${v.resolutionAction ? ` · ${v.resolutionAction}` : ""}` : "Open"}
          </Badge>
        </Card>
      ))}
    </div>
  );
}

function DeploymentsTable({ deployments }: { deployments: DeploymentLog[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Deployment logs</caption>
          <thead className="bg-muted/50 text-muted-foreground text-xs">
            <tr className="text-left">
              <th scope="col" className="px-4 py-2.5 font-medium">Deployed</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Ver.</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Trigger</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Compliance</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Vercel ID</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {deployments.map((d) => (
              <tr key={d.id}>
                <td className="text-muted-foreground px-4 py-2.5 whitespace-nowrap">
                  {dateTime(d.deployedAt)}
                </td>
                <td className="px-4 py-2.5">
                  <Badge variant={d.status === "error" ? "destructive" : d.status === "ready" ? "success" : "neutral"}>
                    {d.status ?? "—"}
                  </Badge>
                </td>
                <td className="text-muted-foreground px-4 py-2.5">
                  {d.contentVersion != null ? `v${d.contentVersion}` : "—"}
                </td>
                <td className="text-muted-foreground px-4 py-2.5">{d.triggeredBy ?? "—"}</td>
                <td className="text-muted-foreground px-4 py-2.5">
                  {d.compliancePassed == null ? "—" : d.compliancePassed ? "Passed" : "Failed"}
                </td>
                <td className="text-muted-foreground px-4 py-2.5 font-mono text-xs">
                  {d.vercelDeploymentId ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---- the page-level view -------------------------------------------------

/**
 * Admin order detail (PRD §11.1): full state-machine history, intake summary,
 * generated-content preview, compliance violations, and deployment logs, plus
 * the Retry / Dismiss recovery actions. Presentational over a shaped
 * `AdminOrderDetail` — all reads + classification happen in the data layer.
 */
export function OrderDetail({ detail }: { detail: AdminOrderDetail }) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link
          href="/admin/orders"
          className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to orders
        </Link>

        <Card className="flex flex-col gap-5 p-6" tone={detail.retriable ? "danger" : "default"}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-mono text-sm font-semibold" title={detail.id}>
                  {detail.id.slice(0, 8)}
                </h1>
                <Badge variant={TONE_VARIANT[detail.tone]}>{detail.stateLabel}</Badge>
                {detail.retryCount > 0 ? (
                  <span className="text-muted-foreground text-xs">
                    retried ×{detail.retryCount}
                  </span>
                ) : null}
              </div>
              <p className="text-lg font-semibold tracking-tight">
                {detail.firmName ?? "Unknown firm"}
              </p>
              <p className="text-muted-foreground text-sm">{detail.email ?? "—"}</p>
            </div>
            <OrderActions
              orderId={detail.id}
              retriable={detail.retriable}
              hasAlert={Boolean(detail.alert)}
            />
          </div>

          {detail.failureReason || detail.alert ? (
            <div className="bg-destructive/8 border-destructive/30 flex items-start gap-2 rounded-lg border p-3">
              <ShieldAlert className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden />
              <div className="text-sm">
                <p className="font-medium">
                  {detail.alert?.step ? `Failed at: ${detail.alert.step}` : "Failure"}
                </p>
                <p className="text-muted-foreground">
                  {detail.failureReason ?? detail.alert?.message ?? "No detail recorded."}
                </p>
              </div>
            </div>
          ) : null}

          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Created" value={dateTime(detail.createdAt)} />
            <Field label="Completed" value={dateTime(detail.completedAt)} />
            <Field label="State group" value={detail.group.replace(/_/g, " ")} />
            <Field label="Retries" value={detail.retryCount} />
          </dl>
        </Card>
      </div>

      <Section icon={Workflow} title="State-machine history" count={detail.history.length}>
        <StateHistory history={detail.history} />
      </Section>

      <Section icon={FileText} title="Intake">
        {detail.intake ? (
          <Card className="p-6">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field
                label="Existing site"
                value={detail.intake.existingSiteUrl ?? "—"}
              />
              <Field
                label="Scrape result"
                value={detail.intake.hasScrapeResult ? "Captured" : "None"}
              />
              <Field label="Uploaded docs" value={detail.intake.uploadedDocCount} />
              <Field
                label="Structured intake"
                value={detail.intake.hasStructuredIntake ? "Captured" : "None"}
              />
            </dl>
          </Card>
        ) : (
          <EmptyCard>No intake captured for this order yet.</EmptyCard>
        )}
      </Section>

      <Section icon={FileText} title="Generated content" count={detail.content.length}>
        {detail.content.length ? (
          <ContentTable content={detail.content} />
        ) : (
          <EmptyCard>No content generated yet.</EmptyCard>
        )}
      </Section>

      <Section icon={ShieldAlert} title="Compliance violations" count={detail.violations.length}>
        {detail.violations.length ? (
          <ViolationsList violations={detail.violations} />
        ) : (
          <EmptyCard>No violations recorded — Layer 2 found nothing to flag.</EmptyCard>
        )}
      </Section>

      <Section icon={Rocket} title="Deployments" count={detail.deployments.length}>
        {detail.deployments.length ? (
          <DeploymentsTable deployments={detail.deployments} />
        ) : (
          <EmptyCard>No deployments yet — the site hasn&apos;t reached Vercel.</EmptyCard>
        )}
      </Section>
    </div>
  );
}
