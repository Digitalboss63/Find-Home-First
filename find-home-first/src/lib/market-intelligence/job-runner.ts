/** Market intelligence job runner. */
import type { CollectedData } from "./types";
import { resolveGeography } from "./geo-resolver";
import { collectHudPit } from "./collectors/hud-pit";
import { collectHudFmr } from "./collectors/hud-fmr";
import { collectCensusAcs } from "./collectors/census";
import { collectCensusZcta } from "./collectors/census-zcta";
import { collectVaPrograms } from "./collectors/va-programs";
import { collectRentCastMarket } from "./collectors/rentcast-market";
import { collectHudIncomeLimits } from "./collectors/hud-income-limits";
import { collectHudChas } from "./collectors/hud-chas";
import { scoreMarket } from "./scoring";
import { buildReport } from "./report-builder";
import { scoreZipOpportunities } from "@/lib/opportunity-engine/zip-rankings";
import { createJob, updateJobStatus, saveReport, saveOpportunityScores, getNextReportVersion } from "../repository-intelligence";
import type { DrizzleDb } from "@/db/client";

export interface RunJobInput { db: DrizzleDb; organizationId: string; projectId: string; projectName: string; community: string; targetPopulation: string; triggeredBy: string | null; fetchFn?: typeof fetch; }
export interface RunJobResult { jobId: string; reportId: string; version: number; status: "complete" | "failed"; verdict?: string; error?: string; }

export async function runMarketIntelligenceJob(input: RunJobInput): Promise<RunJobResult> {
  const { db, organizationId, projectId, projectName, community, targetPopulation, triggeredBy, fetchFn } = input;
  const jobId = await createJob(db, { organizationId, projectId, triggeredBy });
  try {
    await updateJobStatus(db, jobId, "running");
    const geo = resolveGeography(community);
    const collectedAt = new Date().toISOString();
    const fallback = (key: string, agency: string, dataset: string, error: unknown) => ({ data: null, status: "not_verified" as const, source: { sourceKey: key, sourceAgency: agency, datasetName: dataset, directUrl: null as string | null, reportingPeriod: "Error", geography: geo.city, retrievedAt: collectedAt, retrievalMethod: "api" as const, confidence: "not_verified" as const, isDerived: false }, error: error instanceof Error ? error.message : "Collection failed" });

    const [pit, fmr, census, rentcast, incomeLimits, chas] = await Promise.all([
      collectHudPit(geo, { fetchFn }).catch((e) => fallback("hud_pit", "HUD", "PIT Count", e)),
      collectHudFmr(geo, { fetchFn }).catch((e) => fallback("hud_fmr", "HUD", "FMR", e)),
      collectCensusAcs(geo, { fetchFn }).catch((e) => fallback("census_acs", "Census", "ACS", e)),
      collectRentCastMarket(geo, { fetchFn, apiKey: process.env.RENTCAST_API_KEY }).catch((e) => fallback("rentcast_market", "RentCast", "Rental Listings", e)),
      collectHudIncomeLimits(geo, { fetchFn }).catch((e) => fallback("hud_income_limits", "HUD", "Income Limits", e)),
      collectHudChas(geo, { fetchFn }).catch((e) => fallback("hud_chas", "HUD", "CHAS", e)),
    ]);

    const zipCodes = [...new Set((rentcast.data?.sampleListings ?? []).map((l) => l.zipCode).filter((z): z is string => Boolean(z)))];
    const zipDemographics = await collectCensusZcta(geo, zipCodes, { fetchFn, apiKey: process.env.CENSUS_API_KEY }).catch((e) => fallback("census_acs_zcta", "Census", "ACS ZCTA", e));
    const vaPrograms = collectVaPrograms(geo);
    const collectedData: CollectedData = { geo, pit, fmr, census, zipDemographics, rentcast, vaPrograms, incomeLimits, chas, collectedAt };

    const scoring = scoreMarket(collectedData);
    const version = await getNextReportVersion(db, organizationId, projectId);
    const reportId = crypto.randomUUID();
    const snapshot = buildReport(reportId, projectId, projectName, targetPopulation, collectedData, scoring, version);
    const zipRankings = scoreZipOpportunities(collectedData);
    snapshot.opportunityRankings = zipRankings;

    const sourcesSummary = JSON.stringify({ pit: pit.status, fmr: fmr.status, census: census.status, zipDemographics: zipDemographics.status, rentcast: rentcast.status, vaPrograms: vaPrograms.status, incomeLimits: incomeLimits.status, chas: chas.status });
    const savedReportId = await saveReport(db, { id: reportId, organizationId, projectId, jobId, version, status: "complete", reportJson: JSON.stringify(snapshot), dataThroughDate: snapshot.dataThroughDate });
    await saveOpportunityScores(db, organizationId, projectId, zipRankings);
    await updateJobStatus(db, jobId, "complete", { sourcesSummary, completedAt: new Date() });
    return { jobId, reportId: savedReportId, version, status: "complete", verdict: scoring.verdict };
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 200) : "Unknown error";
    await updateJobStatus(db, jobId, "failed", { errorMessage: msg, completedAt: new Date() }).catch(() => {});
    return { jobId, reportId: "", version: 0, status: "failed", error: msg };
  }
}
