/**
 * POST /api/projects/[id]/market-intelligence/run
 *
 * Triggers a market intelligence collection run for the project.
 * Returns immediately with jobId; collection runs synchronously in the handler.
 *
 * Authorization: requireOrganization() — orgId from Clerk only.
 * Cross-org: verified via projectBelongsToOrg (includes orgId in query).
 */
export const runtime = "nodejs";
export const maxDuration = 60; // seconds — allow time for external API calls

import { type NextRequest, NextResponse } from "next/server";
import { requireOrganization } from "@/lib/auth";
import { projectBelongsToOrg, getProjectById } from "@/lib/repository";
import { getDb } from "@/db/client";
import { getLatestJob, getLatestReport } from "@/lib/repository-intelligence";
import { runMarketIntelligenceJob } from "@/lib/market-intelligence/job-runner";
import { reportNeedsUpdate } from "@/lib/market-intelligence/report-version";
import type { MarketReportSnapshot } from "@/lib/export/types";

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between refreshes

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  let orgCtx: Awaited<ReturnType<typeof requireOrganization>>;
  try {
    orgCtx = await requireOrganization();
  } catch {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const { organizationId, user } = orgCtx;
  const { id: projectId } = await params;

  const belongs = await projectBelongsToOrg(projectId, organizationId);
  if (!belongs) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  // Cooldown: prevent duplicate runs
  try {
    const [latestJob, latestReport] = await Promise.all([
      getLatestJob(db, organizationId, projectId),
      getLatestReport(db, organizationId, projectId),
    ]);
    let outdatedReport = false;
    if (latestReport) {
      try {
        outdatedReport = reportNeedsUpdate(
          JSON.parse(latestReport.reportJson) as MarketReportSnapshot,
        );
      } catch {
        outdatedReport = true;
      }
    }
    if (latestJob && latestJob.status === "running") {
      return NextResponse.json({ error: "A report generation is already in progress." }, { status: 409 });
    }
    if (!outdatedReport && latestJob && latestJob.status === "complete" && latestJob.completedAt) {
      const elapsed = Date.now() - latestJob.completedAt.getTime();
      if (elapsed < COOLDOWN_MS) {
        return NextResponse.json(
          { error: `Data is fresh. Next refresh available in ${Math.ceil((COOLDOWN_MS - elapsed) / 60000)} minute(s).` },
          { status: 429 }
        );
      }
    }
  } catch {
    // Non-fatal — proceed with run
  }

  const project = await getProjectById(projectId, organizationId);
  if (!project) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const result = await runMarketIntelligenceJob({
    db,
    organizationId,
    projectId,
    projectName: project.name,
    community: project.community,
    targetPopulation: "Veterans",
    triggeredBy: user.clerkUserId,
  });

  if (result.status === "failed") {
    return NextResponse.json({ error: "Report generation failed. Please try again." }, { status: 500 });
  }

  return NextResponse.json({
    jobId: result.jobId,
    reportId: result.reportId,
    version: result.version,
    verdict: result.verdict,
  });
}
