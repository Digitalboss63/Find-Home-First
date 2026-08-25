import { and, eq } from "drizzle-orm";
import { requireOrganization } from "@/lib/auth";
import { getDb } from "@/db/client";
import { propertySearchDrafts } from "@/db/schema";
import { getProjectById, projectBelongsToOrg } from "@/lib/repository";
import { getLatestReport } from "@/lib/repository-intelligence";
import type { MarketReportSnapshot } from "@/lib/export/types";

interface PageProps {
  searchParams: Promise<{ project?: string; zip?: string }>;
}

export default async function HousingSearchDiagnosticPage({ searchParams }: PageProps) {
  const { organizationId, user } = await requireOrganization();
  const params = await searchParams;
  const projectId = (params.project ?? "").trim();
  const zip = (params.zip ?? "").trim();

  const validProject = projectId
    ? await projectBelongsToOrg(projectId, organizationId)
    : false;

  if (!validProject) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-bold">Housing Search Diagnostic</h1>
        <p className="mt-4">Project is missing or does not belong to this organization.</p>
        <pre className="mt-4 rounded-lg bg-slate-100 p-4 text-sm">project={projectId || "(blank)"}</pre>
      </main>
    );
  }

  const project = await getProjectById(projectId, organizationId);
  const db = getDb();

  let reportGeography: { city?: string; stateAbbr?: string } | null = null;
  let savedDraft: {
    city: string;
    state: string;
    zipCode: string;
    updatedAt: Date;
  } | null = null;

  if (db) {
    try {
      const reportRow = await getLatestReport(db, organizationId, projectId);
      if (reportRow?.reportJson) {
        const report = JSON.parse(reportRow.reportJson) as MarketReportSnapshot;
        reportGeography = report.geography ?? null;
      }
    } catch (error) {
      console.error("[housing-search-diagnostic] report read failed", error);
    }

    try {
      const rows = await db
        .select({
          city: propertySearchDrafts.city,
          state: propertySearchDrafts.state,
          zipCode: propertySearchDrafts.zipCode,
          updatedAt: propertySearchDrafts.updatedAt,
        })
        .from(propertySearchDrafts)
        .where(
          and(
            eq(propertySearchDrafts.organizationId, organizationId),
            eq(propertySearchDrafts.userId, user.dbUserId),
            eq(propertySearchDrafts.projectId, projectId)
          )
        )
        .limit(1);
      savedDraft = rows[0] ?? null;
    } catch (error) {
      console.error("[housing-search-diagnostic] draft read failed", error);
    }
  }

  const computedCity = reportGeography?.city ?? project?.community?.split(",")[0]?.trim() ?? savedDraft?.city ?? "";
  const computedState = reportGeography?.stateAbbr ?? project?.community?.split(",")[1]?.trim() ?? savedDraft?.state ?? "";
  const computedZip = /^\d{5}$/.test(zip) ? zip : savedDraft?.zipCode ?? "";

  const rows = [
    ["Project ID", projectId],
    ["Project name", project?.name ?? "(not found)"],
    ["Project community", project?.community ?? "(blank)"],
    ["Project status", project?.currentStatus ?? "(blank)"],
    ["URL ZIP", zip || "(blank)"],
    ["Report city", reportGeography?.city ?? "(blank)"],
    ["Report state", reportGeography?.stateAbbr ?? "(blank)"],
    ["Saved draft city", savedDraft?.city ?? "(none)"],
    ["Saved draft state", savedDraft?.state ?? "(none)"],
    ["Saved draft ZIP", savedDraft?.zipCode ?? "(none)"],
    ["Saved draft updated", savedDraft?.updatedAt?.toISOString() ?? "(none)"],
    ["Computed handoff city", computedCity || "(blank)"],
    ["Computed handoff state", computedState || "(blank)"],
    ["Computed handoff ZIP", computedZip || "(blank)"],
  ];

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold">Housing Search Diagnostic</h1>
      <p className="mt-2 text-sm opacity-70">Read-only production state. No search data is changed here.</p>
      <div className="mt-6 overflow-hidden rounded-lg border">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[220px_1fr] gap-4 border-b px-4 py-3 last:border-b-0">
            <strong>{label}</strong>
            <span className="break-all">{value}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
