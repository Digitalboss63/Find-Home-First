/**
 * Export types — shared between PDF and Excel generators.
 *
 * All export data comes from a saved MarketReport snapshot.
 * Never regenerated from current DB values.
 *
 * Server-only: never import in client components.
 */

// ─── Report snapshot (loaded from market_research_reports.report_json) ────────

export interface ReportGeography {
  city: string;
  stateAbbr: string;
  county?: string | null;
  metro?: string | null;
  fmrArea?: string | null;
  cocId?: string | null;
  cocName?: string | null;
  phaName?: string | null;
}

export interface ScorecardCategory {
  key: string;
  label: string;
  numericScore: number | null; // 0–100, null = UNKNOWN
  band: "High" | "Medium" | "Low" | "Unknown";
  weight: number; // 0.0–1.0
  weightedContribution: number | null;
  reason: string;
  missingEvidence?: string | null;
}

export interface DemographicMetric {
  metricKey: string;
  label: string;
  numericValue: number | null;
  textValue: string | null;
  unit: string;
  percentage?: number | null;
  comparisonPopulation?: string | null;
  reportingPeriod: string;
  geographyType: string;
  geographyName: string;
  confidence: "high" | "medium" | "low" | "not_verified";
  sourceKey: string;
  isDerived: boolean;
  calculationMethod?: string | null;
}

export interface ProgramOpportunity {
  programName: string;
  fitRank: "Best Immediate" | "Possible" | "Future/Constrained";
  populationServed: string;
  assistanceAvailable: string;
  findHomeFirstRole: string;
  localAdminOrg: string | null;
  sharedHousingCompatibility: string;
  leaseRequirements: string | null;
  inspectionRequirements: string | null;
  referralProcess: string | null;
  currentAvailability: string;
  unresolvedRestrictions: string | null;
  sourceKey: string;
  reportingDate: string;
}

export interface EconomicsScenario {
  label: "Conservative" | "Expected" | "Strong";
  occupancyPct: number;
  usableRooms: number;
  expectedOccupiedRooms: number;
  revenueUsd: number | null;
  propertyRentUsd: number | null;
  utilitiesUsd: number | null;
  prepFurnishingUsd: number | null;
  insuranceUsd: number | null;
  maintenanceUsd: number | null;
  vacancyAllowanceUsd: number | null;
  otherCostsUsd: number | null;
  netMarginUsd: number | null;
  breakEvenOccupancyPct: number | null;
  assumptionStatus: "Confirmed" | "Estimated" | "Not Verified";
}

export interface Barrier {
  description: string;
  whyItMatters: string;
  severity: "Critical" | "Material" | "Informational";
  verificationStatus: "Not Verified" | "Partially Verified" | "Verified";
  responsibleParty: string;
  resolutionAction: string;
  blocksApproval: boolean;
}

export interface ReportSource {
  sourceKey: string;
  sourceAgency: string;
  datasetName: string;
  directUrl: string | null;
  reportingPeriod: string;
  geography: string;
  retrievedAt: string;
  retrievalMethod: "api" | "csv_parse" | "web_fetch";
  confidence: "high" | "medium" | "low" | "not_verified";
  isDerived: boolean;
}

export interface LaunchStep {
  stepNumber: number;
  description: string;
}

// ─── Full report snapshot ─────────────────────────────────────────────────────

export interface MarketReportSnapshot {
  analysisEngineVersion?: number;
  reportId: string;
  projectId: string;
  projectName: string;
  version: number;
  generatedAt: string;
  dataThroughDate: string;
  geography: ReportGeography;
  targetPopulation: string;

  verdict: "Go" | "Conditional Go" | "No-Go" | "Insufficient Evidence";
  verdictExplanation: string;
  bestTargetPopulation: string;
  bestProgramOpportunity: string;
  largestBlocker: string;
  primaryNextAction: string;

  overallScore: number | null;
  confidence: "high" | "medium" | "low" | "insufficient_data";
  scorecard: ScorecardCategory[];

  primaryDemographics: DemographicMetric[];
  allDemographics: DemographicMetric[];

  programs: ProgramOpportunity[];

  fmrBenchmarks: { label: string; usd: number }[];
  fmrContext?: {
    geography: string;
    reportingPeriod: string;
    isEstimate: boolean;
  };
  economicsScenarios: EconomicsScenario[];
  economicsConclusion: string;

  barriers: Barrier[];

  launchSteps: LaunchStep[];
  primaryNextActionButton: string;

  sources: ReportSource[];

  /** ZIP/metro opportunity rankings from the Property Opportunity Engine V1. */
  opportunityRankings?: ZipOpportunityRanking[];
}

// ─── Property Opportunity Engine V1 ──────────────────────────────────────────

export interface OpportunityScoreInputSnapshot {
  key: string;
  rawValue: number | string | null;
  normalizedValue: number | null;
  source: string;
  geography: string;
  isEstimated: boolean;
}

export interface ZipOpportunityRanking {
  zipCode: string;
  rank: number;
  label: string;
  veteranNeedIndex: number;
  veteranNeedScore: number;
  placementInfraIndex: number;
  placementInfraScore: number;
  housingEconomicsIndex: number;
  housingEconomicsScore: number;
  propertyAvailIndex: number;
  propertyAvailScore: number;
  opportunityScore: number;
  priorityLevel: "PRIORITY" | "STRONG" | "WATCH" | "LOW";
  confidenceLevel: "HIGH" | "MEDIUM" | "ESTIMATED";
  isEstimated: boolean;
  sourceGeography: string;
  sourceGeographyType: string;
  recommendation: string;
  calculationVersion: string;
  /** Raw/normalized inputs retained in the saved report and DB for score auditability. */
  inputs?: OpportunityScoreInputSnapshot[];
}

// ─── Export input ─────────────────────────────────────────────────────────────

export interface ExportInput {
  report: MarketReportSnapshot;
  exportedAt: string;
  onlineReportUrl?: string;
}

// ─── Filename params ──────────────────────────────────────────────────────────

export interface FilenameParams {
  city: string;
  stateAbbr: string;
  targetPopulation: string;
  version: number;
  generatedAt: string;
  format: "pdf" | "xlsx";
}
