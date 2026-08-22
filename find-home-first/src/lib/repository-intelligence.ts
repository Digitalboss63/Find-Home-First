/**
 * Repository functions for market intelligence jobs and reports.
 */
import "server-only";
import { eq, and, desc, sql } from "drizzle-orm";
import { marketResearchJobs, marketResearchReports, marketOpportunityScores } from "@/db/schema";
import type { DrizzleDb } from "@/db/client";
import type { JobRow, ReportRow } from "./market-intelligence/types";
import type { ZipOpportunityRanking } from "./export/types";

export async function createJob(db: DrizzleDb, input: { organizationId: string; projectId: string; triggeredBy: string | null }): Promise<string> {
  const rows = await db.insert(marketResearchJobs).values({ organizationId: input.organizationId, projectId: input.projectId, triggeredBy: input.triggeredBy, status: "pending" }).returning({ id: marketResearchJobs.id });
  return rows[0].id;
}

export async function updateJobStatus(db: DrizzleDb, jobId: string, status: "pending" | "running" | "complete" | "failed", extras: { errorMessage?: string; sourcesSummary?: string; completedAt?: Date } = {}): Promise<void> {
  await db.update(marketResearchJobs).set({ status, errorMessage: extras.errorMessage ?? null, sourcesSummary: extras.sourcesSummary ?? null, startedAt: status === "running" ? new Date() : undefined, completedAt: extras.completedAt ?? null, updatedAt: new Date() }).where(eq(marketResearchJobs.id, jobId));
}

export async function getLatestJob(db: DrizzleDb, organizationId: string, projectId: string): Promise<JobRow | null> {
  const rows = await db.select().from(marketResearchJobs).where(and(eq(marketResearchJobs.organizationId, organizationId), eq(marketResearchJobs.projectId, projectId))).orderBy(desc(marketResearchJobs.createdAt)).limit(1);
  if (!rows.length) return null;
  const r = rows[0];
  return { id: r.id, organizationId: r.organizationId, projectId: r.projectId, status: r.status, triggeredBy: r.triggeredBy, startedAt: r.startedAt, completedAt: r.completedAt, errorMessage: r.errorMessage, sourcesSummary: r.sourcesSummary, createdAt: r.createdAt };
}

export async function getNextReportVersion(db: DrizzleDb, organizationId: string, projectId: string): Promise<number> {
  const rows = await db.select({ maxVersion: sql<number>`COALESCE(MAX(${marketResearchReports.version}), 0)` }).from(marketResearchReports).where(and(eq(marketResearchReports.organizationId, organizationId), eq(marketResearchReports.projectId, projectId)));
  return (rows[0]?.maxVersion ?? 0) + 1;
}

export async function saveReport(db: DrizzleDb, input: { id: string; organizationId: string; projectId: string; jobId: string; version: number; status: string; reportJson: string; dataThroughDate: string }): Promise<string> {
  return db.transaction(async (tx) => {
    await tx.update(marketResearchReports).set({ status: "superseded" }).where(and(eq(marketResearchReports.organizationId, input.organizationId), eq(marketResearchReports.projectId, input.projectId), eq(marketResearchReports.status, "complete")));
    const rows = await tx.insert(marketResearchReports).values({ id: input.id, organizationId: input.organizationId, projectId: input.projectId, jobId: input.jobId, version: input.version, status: "complete", reportJson: input.reportJson, dataThroughDate: input.dataThroughDate }).returning({ id: marketResearchReports.id });
    return rows[0].id;
  });
}

export async function saveOpportunityScores(db: DrizzleDb, organizationId: string, projectId: string, rankings: ZipOpportunityRanking[]): Promise<void> {
  if (!rankings.length) return;
  await db.transaction(async (tx) => {
    for (const r of rankings) {
      await tx.insert(marketOpportunityScores).values({
        organizationId, projectId, zipCode: r.zipCode, rank: r.rank,
        veteranNeedIndex: String(r.veteranNeedIndex), veteranNeedScore: String(r.veteranNeedScore),
        placementInfraIndex: String(r.placementInfraIndex), placementInfraScore: String(r.placementInfraScore),
        housingEconomicsIndex: String(r.housingEconomicsIndex), housingEconomicsScore: String(r.housingEconomicsScore),
        propertyAvailIndex: String(r.propertyAvailIndex), propertyAvailScore: String(r.propertyAvailScore),
        opportunityScore: r.opportunityScore, priorityLevel: r.priorityLevel, confidenceLevel: r.confidenceLevel,
        sourceGeography: r.sourceGeography, sourceGeographyType: r.sourceGeographyType,
        isEstimated: r.isEstimated, recommendation: r.recommendation,
        inputsJson: JSON.stringify({ reportRanking: r }), calculationVersion: r.calculationVersion,
      }).onConflictDoUpdate({
        target: [marketOpportunityScores.projectId, marketOpportunityScores.zipCode, marketOpportunityScores.calculationVersion],
        set: {
          rank: r.rank, veteranNeedIndex: String(r.veteranNeedIndex), veteranNeedScore: String(r.veteranNeedScore),
          placementInfraIndex: String(r.placementInfraIndex), placementInfraScore: String(r.placementInfraScore),
          housingEconomicsIndex: String(r.housingEconomicsIndex), housingEconomicsScore: String(r.housingEconomicsScore),
          propertyAvailIndex: String(r.propertyAvailIndex), propertyAvailScore: String(r.propertyAvailScore),
          opportunityScore: r.opportunityScore, priorityLevel: r.priorityLevel, confidenceLevel: r.confidenceLevel,
          sourceGeography: r.sourceGeography, sourceGeographyType: r.sourceGeographyType, isEstimated: r.isEstimated,
          recommendation: r.recommendation, inputsJson: JSON.stringify({ reportRanking: r }), calculatedAt: new Date(),
        },
      });
    }
  });
}

export async function getLatestReport(db: DrizzleDb, organizationId: string, projectId: string): Promise<ReportRow | null> {
  const rows = await db.select().from(marketResearchReports).where(and(eq(marketResearchReports.organizationId, organizationId), eq(marketResearchReports.projectId, projectId), eq(marketResearchReports.status, "complete"))).orderBy(desc(marketResearchReports.version)).limit(1);
  if (!rows.length) return null;
  const r = rows[0];
  return { id: r.id, organizationId: r.organizationId, projectId: r.projectId, jobId: r.jobId, version: r.version, status: r.status, reportJson: r.reportJson, generatedAt: r.generatedAt, dataThroughDate: r.dataThroughDate, createdAt: r.createdAt };
}

export async function getReportByVersion(db: DrizzleDb, organizationId: string, projectId: string, version: number): Promise<ReportRow | null> {
  const rows = await db.select().from(marketResearchReports).where(and(eq(marketResearchReports.organizationId, organizationId), eq(marketResearchReports.projectId, projectId), eq(marketResearchReports.version, version))).limit(1);
  if (!rows.length) return null;
  const r = rows[0];
  return { id: r.id, organizationId: r.organizationId, projectId: r.projectId, jobId: r.jobId, version: r.version, status: r.status, reportJson: r.reportJson, generatedAt: r.generatedAt, dataThroughDate: r.dataThroughDate, createdAt: r.createdAt };
}
