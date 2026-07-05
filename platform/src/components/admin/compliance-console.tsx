"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Loader2, ShieldCheck, UploadCloud } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { postJson } from "@/lib/api/client";
import type { DraftSummary } from "@/lib/admin/compliance/drafts";
import type { ProposedChange, ResearchProposal } from "@/lib/admin/compliance/research";
import type { RulesetVersionRow } from "@/lib/admin/compliance/versions";

/**
 * `/admin/compliance` console (PRD §5.7, §11.2). Renders the version index with
 * live-sites-affected counts, the research-agent trigger (→ cited proposal, never
 * auto-published), and the draft review/publish flow. The two-person publish gate
 * is reflected in the UI via `checkTwoPersonApproval` and enforced server-side.
 */
export function ComplianceConsole({
  versions,
  drafts,
}: {
  versions: RulesetVersionRow[];
  drafts: DraftSummary[];
}) {
  return (
    <div className="flex flex-col gap-8">
      <ResearchPanel baseVersion={versions.find((v) => v.published)?.version ?? "1.0"} />
      <VersionsTable versions={versions} />
      <DraftsList drafts={drafts} />
    </div>
  );
}

// ---- research agent ------------------------------------------------------

function ResearchPanel({ baseVersion }: { baseVersion: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<ResearchProposal | null>(null);
  const [targetVersion, setTargetVersion] = useState("");
  const [creating, setCreating] = useState(false);

  async function runScan() {
    setPending(true);
    setError(null);
    const { data, error } = await postJson<{ proposal: ResearchProposal }>(
      "/api/admin/compliance/research",
      {},
    );
    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    setProposal(data?.proposal ?? null);
  }

  async function createDraft() {
    if (!proposal || !targetVersion.trim()) return;
    setCreating(true);
    setError(null);
    const { error } = await postJson("/api/admin/compliance/drafts", {
      baseVersion: proposal.baseVersion,
      targetVersion: targetVersion.trim(),
      research: proposal,
    });
    setCreating(false);
    if (error) {
      setError(error.message);
      return;
    }
    setProposal(null);
    setTargetVersion("");
    router.refresh();
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <FlaskConical className="text-primary size-4" aria-hidden />
            Research agent
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Scan SEC.gov, FINRA, and state boards for changes since v{baseVersion}. Produces a cited diff
            proposal for review — it never publishes on its own.
          </p>
        </div>
        <Button onClick={() => void runScan()} disabled={pending} data-testid="run-research">
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <FlaskConical aria-hidden />}
          {pending ? "Scanning…" : "Run scan"}
        </Button>
      </div>

      {error ? <p className="text-destructive text-sm" role="alert">{error}</p> : null}

      {proposal ? (
        <div className="border-border/70 flex flex-col gap-3 rounded-xl border p-4" data-testid="proposal">
          <p className="text-sm font-medium">{proposal.summary || "No summary returned."}</p>
          {proposal.changes.length === 0 ? (
            <p className="text-muted-foreground text-sm">No material regulatory change found.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {proposal.changes.map((c, i) => (
                <ProposalChange key={i} change={c} />
              ))}
            </ul>
          )}
          {proposal.changes.length > 0 ? (
            <div className="flex flex-wrap items-end gap-2 pt-1">
              <label className="text-sm">
                <span className="text-muted-foreground mb-1 block text-xs">New version</span>
                <Input
                  value={targetVersion}
                  onChange={(e) => setTargetVersion(e.target.value)}
                  placeholder="1.1"
                  className="w-28"
                  aria-label="New version"
                />
              </label>
              <Button
                variant="outline"
                onClick={() => void createDraft()}
                disabled={creating || !targetVersion.trim()}
              >
                {creating ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Create draft from proposal
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function ProposalChange({ change }: { change: ProposedChange }) {
  return (
    <li className="border-border/60 flex flex-col gap-1 border-l-2 pl-3 text-sm">
      <div className="flex items-center gap-2">
        <Badge variant={change.action === "remove" ? "destructive" : change.action === "add" ? "success" : "warning"}>
          {change.action}
        </Badge>
        <span className="text-muted-foreground text-xs">{change.category}</span>
      </div>
      <p>{change.summary}</p>
      <ul className="text-muted-foreground flex flex-col gap-0.5 text-xs">
        {change.citations.map((cit, i) => (
          <li key={i}>
            <a href={cit.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              {cit.source}: {cit.title}
            </a>
          </li>
        ))}
      </ul>
    </li>
  );
}

// ---- versions ------------------------------------------------------------

function VersionsTable({ versions }: { versions: RulesetVersionRow[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold tracking-tight">Ruleset versions</h2>
      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground border-b text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 font-medium">Version</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Reviewers</th>
              <th className="px-4 py-3 font-medium">Live sites affected</th>
            </tr>
          </thead>
          <tbody>
            {versions.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-muted-foreground px-4 py-6 text-center">
                  No rulesets found.
                </td>
              </tr>
            ) : (
              versions.map((v) => (
                <tr key={v.versionString} className="border-b last:border-0" data-testid={`version-${v.version}`}>
                  <td className="px-4 py-3 font-medium">{v.versionString}</td>
                  <td className="px-4 py-3">
                    {v.published ? (
                      <Badge variant="success">Published</Badge>
                    ) : v.approved ? (
                      <Badge variant="warning">Approved</Badge>
                    ) : (
                      <Badge variant="neutral">Draft</Badge>
                    )}
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {v.reviewers.length ? v.reviewers.join(", ") : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums" data-testid={`affected-${v.version}`}>
                    {v.affectedSiteCount}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </section>
  );
}

// ---- drafts + review/publish ---------------------------------------------

function DraftsList({ drafts }: { drafts: DraftSummary[] }) {
  const open = drafts.filter((d) => d.status !== "published");
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold tracking-tight">Drafts in review</h2>
      {open.length === 0 ? (
        <Card className="text-muted-foreground p-5 text-sm">
          No open drafts. Run the research agent or author a new version to start one.
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {open.map((d) => (
            <DraftCard key={d.id} draft={d} />
          ))}
        </div>
      )}
    </section>
  );
}

function DraftCard({ draft }: { draft: DraftSummary }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const gate = draft.approval;

  async function act(path: string, body: unknown, key: string) {
    setPending(key);
    setError(null);
    const { error } = await postJson(path, body);
    setPending(null);
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <Card className="flex flex-col gap-3 p-5" data-testid={`draft-${draft.id}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">
            {draft.industry} v{draft.baseVersion ?? "?"} → v{draft.targetVersion}
          </p>
          <p className="text-muted-foreground text-xs">
            {draft.hasResearch ? "Seeded by research scan · " : ""}
            {draft.reviews.filter((r) => r.decision === "signed_off").length} sign-off(s)
          </p>
        </div>
        {gate.ok ? (
          <Badge variant="success">
            <ShieldCheck className="mr-1 size-3" aria-hidden />
            Ready to publish
          </Badge>
        ) : (
          <Badge variant="warning">Needs two-person sign-off</Badge>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={pending != null}
          onClick={() => void act(`/api/admin/compliance/drafts/${draft.id}/review`, { role: "drafter" }, "drafter")}
        >
          Sign off as drafter
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending != null}
          onClick={() => void act(`/api/admin/compliance/drafts/${draft.id}/review`, { role: "approver" }, "approver")}
        >
          Sign off as approver
        </Button>
        <Button
          size="sm"
          disabled={!gate.ok || pending != null}
          title={gate.ok ? undefined : gate.reasons.join(" ")}
          onClick={() => void act(`/api/admin/compliance/drafts/${draft.id}/publish`, {}, "publish")}
          data-testid={`publish-${draft.id}`}
        >
          {pending === "publish" ? <Loader2 className="animate-spin" aria-hidden /> : <UploadCloud aria-hidden />}
          Publish
        </Button>
      </div>

      {!gate.ok ? (
        <p className="text-muted-foreground text-xs">{gate.reasons.join(" ")}</p>
      ) : null}
      {error ? <p className="text-destructive text-sm" role="alert">{error}</p> : null}
    </Card>
  );
}
