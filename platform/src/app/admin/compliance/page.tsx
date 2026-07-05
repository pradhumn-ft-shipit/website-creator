import { listRulesetVersions } from "@/lib/admin/compliance/versions";
import { listDraftsWithClient } from "@/lib/admin/compliance/drafts";
import { ComplianceConsole } from "@/components/admin/compliance-console";

/** Never statically cached — versions, affected counts, and drafts are live. */
export const dynamic = "force-dynamic";

/**
 * `/admin/compliance` — internal ruleset management (PRD §5.7, §11.2). Reads the
 * version index (with live-sites-affected counts) + open drafts via the
 * service-role data layer, then hands them to the console for the research /
 * review / publish flow. The two-person publish gate is enforced server-side.
 */
export default async function AdminCompliancePage() {
  const [versions, drafts] = await Promise.all([
    listRulesetVersions(),
    listDraftsWithClient(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Compliance</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Ruleset versions, the research agent, and the two-person publish workflow. Publishing a version
          re-validates every affected live site.
        </p>
      </div>
      <ComplianceConsole versions={versions} drafts={drafts} />
    </div>
  );
}
