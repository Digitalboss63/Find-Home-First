/**
 * Assembles a complete MarketReportSnapshot from collected data and scoring.
 * Output is the same shape used by the PDF/Excel exporters.
 * Pure function — no DB, no network.
 */
import type { MarketReportSnapshot, DemographicMetric, ProgramOpportunity, EconomicsScenario, Barrier, LaunchStep } from "../export/types";
import type { CollectedData, ScoringResult } from "./types";
import { CURRENT_REPORT_ENGINE_VERSION } from "./report-version";

export function buildReport(
  reportId: string,
  projectId: string,
  projectName: string,
  targetPopulation: string,
  data: CollectedData,
  scoring: ScoringResult,
  version: number,
): MarketReportSnapshot {
  const now = new Date().toISOString();
  const geo = data.geo;

  // ── Demographics ────────────────────────────────────────────────────────────
  const primaryDemographics: DemographicMetric[] = [];
  const pit = data.pit.data;
  if (pit) {
    if (pit.totalHomeless !== null) primaryDemographics.push({ metricKey: "pit_total_homeless", label: "Total homeless population", numericValue: pit.totalHomeless, textValue: null, unit: "count", reportingPeriod: `${pit.reportingYear} PIT`, geographyType: "coc", geographyName: geo.cocId ? `${geo.cocId} ${geo.cocName ?? ""}`.trim() : geo.city, confidence: "high", sourceKey: "hud_pit", isDerived: false });
    if (pit.unsheltered !== null && pit.totalHomeless) primaryDemographics.push({ metricKey: "pit_unsheltered", label: "Unsheltered population", numericValue: pit.unsheltered, textValue: null, unit: "count", percentage: pit.totalHomeless > 0 ? pit.unsheltered / pit.totalHomeless : null, reportingPeriod: `${pit.reportingYear} PIT`, geographyType: "coc", geographyName: geo.cocId ? `${geo.cocId} ${geo.cocName ?? ""}`.trim() : geo.city, confidence: "high", sourceKey: "hud_pit", isDerived: false });
    if (pit.adultsWithoutChildren !== null && pit.totalHomeless) primaryDemographics.push({ metricKey: "pit_adults_without_children", label: "Adults without children", numericValue: pit.adultsWithoutChildren, textValue: null, unit: "count", percentage: pit.totalHomeless > 0 ? pit.adultsWithoutChildren / pit.totalHomeless : null, reportingPeriod: `${pit.reportingYear} PIT`, geographyType: "coc", geographyName: geo.cocId ? `${geo.cocId} ${geo.cocName ?? ""}`.trim() : geo.city, confidence: "high", sourceKey: "hud_pit", isDerived: false });
    if (pit.veterans2026Estimate !== null) primaryDemographics.push({ metricKey: "pit_veterans", label: "Homeless veterans", numericValue: pit.veterans2026Estimate, textValue: null, unit: "count", reportingPeriod: "2026 PIT trend (estimated)", geographyType: "coc", geographyName: geo.cocId ? `${geo.cocId} ${geo.cocName ?? ""}`.trim() : geo.city, confidence: "medium", sourceKey: "hud_pit", isDerived: true, calculationMethod: "2026 trend estimate derived from 2024 official count" });
    else if (pit.veterans !== null) primaryDemographics.push({ metricKey: "pit_veterans", label: "Homeless veterans", numericValue: pit.veterans, textValue: null, unit: "count", reportingPeriod: `${pit.reportingYear} PIT`, geographyType: "coc", geographyName: geo.cocId ? `${geo.cocId} ${geo.cocName ?? ""}`.trim() : geo.city, confidence: "high", sourceKey: "hud_pit", isDerived: false });
    if (pit.chronicHomeless !== null && pit.totalHomeless) primaryDemographics.push({ metricKey: "pit_chronically_homeless", label: "Chronically homeless", numericValue: pit.chronicHomeless, textValue: null, unit: "count", percentage: pit.totalHomeless > 0 ? pit.chronicHomeless / pit.totalHomeless : null, reportingPeriod: `${pit.reportingYear} PIT`, geographyType: "coc", geographyName: geo.cocId ? `${geo.cocId} ${geo.cocName ?? ""}`.trim() : geo.city, confidence: "high", sourceKey: "hud_pit", isDerived: false });
    if (pit.blackHomeless !== null && pit.blackPct !== null && pit.totalHomeless) {
      const census = data.census.data;
      const comparison = census?.blackPopulationPct ? `Black city population: ${(census.blackPopulationPct * 100).toFixed(1)}% (${census.acsVintage})` : undefined;
      primaryDemographics.push({ metricKey: "pit_black_homeless", label: "Black homeless population", numericValue: pit.blackHomeless, textValue: null, unit: "count", percentage: pit.blackPct, comparisonPopulation: comparison, reportingPeriod: `${pit.reportingYear} PIT`, geographyType: "coc", geographyName: geo.cocId ? `${geo.cocId} ${geo.cocName ?? ""}`.trim() : geo.city, confidence: "high", sourceKey: "hud_pit", isDerived: false });
    }
  }

  // CHAS housing needs data
  const chas = data.chas.data;
  if (chas) {
    if (chas.renterCostBurdened30pct !== null) {
      primaryDemographics.push({
        metricKey: "chas_renter_cost_burdened",
        label: "Renters with housing cost burden >30%",
        numericValue: chas.renterCostBurdened30pct,
        textValue: null,
        unit: "count",
        reportingPeriod: chas.reportingPeriod,
        geographyType: "county",
        geographyName: chas.geography,
        confidence: "medium",
        sourceKey: "hud_chas",
        isDerived: false,
      });
    }
    if (chas.renterCostBurdened50pct !== null) {
      primaryDemographics.push({
        metricKey: "chas_renter_severe_burden",
        label: "Renters with severe housing cost burden >50%",
        numericValue: chas.renterCostBurdened50pct,
        textValue: null,
        unit: "count",
        reportingPeriod: chas.reportingPeriod,
        geographyType: "county",
        geographyName: chas.geography,
        confidence: "medium",
        sourceKey: "hud_chas",
        isDerived: false,
      });
    }
  }

  // Income limits context
  const il = data.incomeLimits.data;
  if (il?.medianIncome !== null && il?.medianIncome !== undefined) {
    primaryDemographics.push({
      metricKey: "hud_area_median_income",
      label: "HUD Area Median Income (AMI)",
      numericValue: il.medianIncome,
      textValue: null,
      unit: "usd/year",
      reportingPeriod: il.reportingYear,
      geographyType: "metro",
      geographyName: il.areaName,
      confidence: "high",
      sourceKey: "hud_income_limits",
      isDerived: false,
    });
  }

  // ── Programs ────────────────────────────────────────────────────────────────
  const programs: ProgramOpportunity[] = (data.vaPrograms.data?.programs ?? []).map((p) => ({
    programName: p.programName,
    fitRank: p.fitRank,
    populationServed: p.programName.includes("Veteran") || p.programName.includes("VASH") || p.programName.includes("SSVF") || p.programName.includes("GPD") ? "Veterans experiencing homelessness" : "Single adults experiencing homelessness",
    assistanceAvailable: p.programName === "HUD-VASH" ? "Housing Choice Voucher + VA case management" : p.programName.includes("SSVF") ? "Rapid rehousing grants; temporary financial assistance" : p.programName.includes("GPD") ? "Per diem grant for transitional beds" : "Rental assistance + case management",
    findHomeFirstRole: p.programName.includes("GPD") ? "Not aligned with permanent placement model" : "Property operator; lease rooms to program participants",
    localAdminOrg: p.localAdminOrg,
    sharedHousingCompatibility: p.sharedHousingCompatibility,
    leaseRequirements: "Not Verified — confirm with program administrator",
    inspectionRequirements: p.programName === "HUD-VASH" ? "HUD Housing Quality Standards (HQS) apply" : "Not Verified",
    referralProcess: p.referralProcess,
    currentAvailability: p.currentAvailability,
    unresolvedRestrictions: p.unresolvedRestrictions,
    sourceKey: p.sourceKey,
    reportingDate: p.reportingDate,
  }));

  // ── FMR benchmarks ──────────────────────────────────────────────────────────
  const fmrBenchmarks = data.fmr.data
    ? [
        { label: "Studio", usd: data.fmr.data.studio },
        { label: "1 Bedroom", usd: data.fmr.data.oneBr },
        { label: "2 Bedrooms", usd: data.fmr.data.twoBr },
        { label: "3 Bedrooms", usd: data.fmr.data.threeBr },
        { label: "4 Bedrooms", usd: data.fmr.data.fourBr },
      ]
    : [];
  const fmrContext = data.fmr.data
    ? {
        geography: data.fmr.source.geography,
        reportingPeriod: data.fmr.source.reportingPeriod,
        isEstimate: data.fmr.source.isDerived,
      }
    : undefined;

  // ── Economics scenarios ──────────────────────────────────────────────────────
  const fmr4br = data.fmr.data?.fourBr ?? null;
  const makeScenario = (label: "Conservative" | "Expected" | "Strong", occ: 70 | 80 | 90): EconomicsScenario => ({
    label,
    occupancyPct: occ,
    usableRooms: 4,
    expectedOccupiedRooms: 4 * (occ / 100),
    revenueUsd: null, // Requires confirmed payment per room
    propertyRentUsd: null,
    utilitiesUsd: 350,
    prepFurnishingUsd: 5000,
    insuranceUsd: null,
    maintenanceUsd: null,
    vacancyAllowanceUsd: null,
    otherCostsUsd: null,
    netMarginUsd: null,
    breakEvenOccupancyPct: null,
    assumptionStatus: "Not Verified",
  });
  const economicsScenarios: EconomicsScenario[] = [makeScenario("Conservative", 70), makeScenario("Expected", 80), makeScenario("Strong", 90)];
  const economicsConclusion = fmr4br && fmrContext?.isEstimate
    ? `Planning estimate only. HUD's statewide FMR median estimate is $${fmr4br.toLocaleString()} for four bedrooms because an exact municipality match was unavailable. Use it for early screening, not a lease decision. Confirm the exact local FMR area and the program-specific per-room payment standard before final modeling.`
    : fmr4br
    ? `Potentially viable pending verification. FMR $${fmr4br.toLocaleString()} (4BR) provides potential revenue headroom over typical market rents. Final determination requires a confirmed property address, confirmed payment standard per room, and verified program payment terms.`
    : "HUD FMR was temporarily unavailable during this report run, so the report will not guess at property economics. Use Update Report to retry the automatic HUD collection. A program administrator must still confirm the program-specific per-room payment standard.";

  // ── Barriers ────────────────────────────────────────────────────────────────
  const barriers: Barrier[] = [
    { description: "Shared-housing arrangement not verified locally", whyItMatters: "Program guidance allows shared housing nationally; local providers apply their own rules.", severity: "Critical", verificationStatus: "Not Verified", responsibleParty: "Local VAMC HUD-VASH coordinator; SSVF grantee", resolutionAction: "Direct confirmation call with VAMC coordinator before leasing any property", blocksApproval: true },
    { description: "Master-lease or sublease structure not verified", whyItMatters: "Program rules on lease structure vary; a misstructured lease can disqualify placement and void payments.", severity: "Critical", verificationStatus: "Not Verified", responsibleParty: "Program administrator; housing attorney", resolutionAction: "Review lease structure with program administrator and housing attorney before signing any lease", blocksApproval: true },
    { description: "Referral process not confirmed", whyItMatters: "No placement is possible without an active referral agreement and intake process.", severity: "Critical", verificationStatus: "Not Verified", responsibleParty: "VA or SSVF referral coordinator", resolutionAction: "Establish referral contact and confirm intake process in writing", blocksApproval: true },
    { description: "Inspection requirements not verified", whyItMatters: "HUD Housing Quality Standards apply to HUD-VASH; rooms must pass inspection before payment begins.", severity: "Critical", verificationStatus: "Not Verified", responsibleParty: "VAMC or contract inspector", resolutionAction: "Review HQS standards and confirm room inspection requirements before preparing any property", blocksApproval: true },
    { description: "Payment standard per room not confirmed", whyItMatters: "SAFMR or local payment standard determines actual revenue; FMR is a benchmark only.", severity: "Critical", verificationStatus: "Not Verified", responsibleParty: "VA or CoC administrator", resolutionAction: "Confirm per-room payment rate with program administrator", blocksApproval: true },
  ];

  // ── Launch steps ────────────────────────────────────────────────────────────
  const launchSteps: LaunchStep[] = [
    { stepNumber: 1, description: "Start with single adult veterans — strongest program compatibility in this market" },
    { stepNumber: 2, description: `Contact ${data.vaPrograms.data?.programs.find(p => p.programName === "HUD-VASH")?.localAdminOrg ?? "local VAMC"} HUD-VASH coordinator — confirm shared-housing eligibility and referral intake` },
    { stepNumber: 3, description: "Contact current SSVF grantees from VA provider directory — confirm shared-housing rules and referral availability" },
    { stepNumber: 4, description: "Confirm master-lease or sublease structure with program administrator and housing attorney" },
    { stepNumber: 5, description: "Confirm inspection requirements and room standards before signing any property lease" },
    { stepNumber: 6, description: fmr4br ? `Search 4+ bedroom rentals using FMR $${fmr4br.toLocaleString()} (4BR) as benchmark` : "Use Update Report to retry automatic HUD FMR collection; continue reviewing current rental listings without treating them as an FMR substitute" },
    { stepNumber: 7, description: "Model complete financials for one candidate property using confirmed payment standard" },
    { stepNumber: 8, description: "Launch one pilot house and complete full referral cycle before expanding" },
  ];

  // ── Sources ─────────────────────────────────────────────────────────────────
  // Cast: SourceRecord allows "static" retrievalMethod; ReportSource does not.
  // VA programs use "static" — map to "web_fetch" for export compatibility.
  const toReportSource = (s: import("./types").SourceRecord): import("../export/types").ReportSource => ({
    ...s,
    retrievalMethod: s.retrievalMethod === "static" ? "web_fetch" : s.retrievalMethod,
  });
  const sources = [
    data.pit.source,
    data.fmr.source,
    data.census.source,
    data.vaPrograms.source,
    ...(data.rentcast.status !== "not_verified" ? [data.rentcast.source] : []),
    ...(data.incomeLimits.status !== "not_verified" ? [data.incomeLimits.source] : []),
    ...(data.chas.status !== "not_verified" ? [data.chas.source] : []),
  ].map(toReportSource);

  return {
    analysisEngineVersion: CURRENT_REPORT_ENGINE_VERSION,
    reportId,
    projectId,
    projectName,
    version,
    generatedAt: now,
    dataThroughDate: now.slice(0, 10),
    geography: {
      city: geo.city,
      stateAbbr: geo.stateAbbr,
      county: geo.county,
      metro: geo.metro,
      fmrArea: geo.fmrArea,
      cocId: geo.cocId,
      cocName: geo.cocName,
      phaName: geo.phaName,
    },
    targetPopulation,
    verdict: scoring.verdict,
    verdictExplanation: scoring.verdictExplanation,
    bestTargetPopulation: scoring.bestTargetPopulation,
    bestProgramOpportunity: scoring.bestProgramOpportunity,
    largestBlocker: scoring.largestBlocker,
    primaryNextAction: scoring.primaryNextAction,
    overallScore: scoring.overallScore,
    confidence: scoring.confidence,
    scorecard: scoring.scorecard,
    primaryDemographics,
    allDemographics: [],
    programs,
    fmrBenchmarks,
    fmrContext,
    economicsScenarios,
    economicsConclusion,
    barriers,
    launchSteps,
    primaryNextActionButton: scoring.primaryNextActionButton,
    sources,
  };
}
