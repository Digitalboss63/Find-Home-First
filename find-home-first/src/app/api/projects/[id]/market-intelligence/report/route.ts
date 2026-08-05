/**
 * GET /api/projects/[id]/market-intelligence/report
 *
 * Returns the latest complete report for the project.
 * organizationId from Clerk session — never from request params.
 */
export const runtime = "nodejs";

import { type NextRequest, NextResponse } from "next/server";
import { requireOrganization } from "@/lib/auth";
import { projectBelongsToOrg } from "@/lib/repository";
import { getDb } from "@/db/client";
import { getLatestReport, getLatestJob } from "@/lib/repository-intelligence";
import type { MarketReportSnapshot } from "@/lib/export/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  let orgCtx: Awaited<ReturnType<typeof requireOrganization>>;
  try {
    orgCtx = await requireOrganization();
  } catch {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const { organizationId } = orgCtx;
  const { id: projectId } = await params;

  const belongs = await projectBelongsToOrg(projectId, organizationId);
  if (!belongs) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const [report, latestJob] = await Promise.all([
    getLatestReport(db, organizationId, projectId),
    getLatestJob(db, organizationId, projectId),
  ]);

  if (!report) {
    return NextResponse.json({
      report: null,
      jobStatus: latestJob?.status ?? null,
      jobError: latestJob?.status === "failed" ? latestJob.errorMessage : null,
    });
  }

  let snapshot: MarketReportSnapshot;
  try {
    snapshot = JSON.parse(report.reportJson) as MarketReportSnapshot;
  } catch {
    return NextResponse.json({ error: "Report data could not be read." }, { status: 500 });
  }

  return NextResponse.json({
    report: snapshot,
    version: report.version,
    generatedAt: report.generatedAt,
    dataThroughDate: report.dataThroughDate,
    jobStatus: latestJob?.status ?? "complete",
    sourcesSummary: latestJob?.sourcesSummary ? JSON.parse(latestJob.sourcesSummary) as Record<string, string> : null,
  });
}
