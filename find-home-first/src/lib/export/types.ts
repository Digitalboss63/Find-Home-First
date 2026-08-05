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
  sharedHousingCompatibility: string; // e.g. "Nationally allowable — local verification required"
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
  occupancyPct: number; // 70 | 80 | 90
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
  retrievedAt: string; // ISO
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
  // Identity
  reportId: string;
  projectId: string;
  projectName: string;
  version: number;
  generatedAt: string;   // ISO
  dataThroughDate: string;
  geography: ReportGeography;
  targetPopulation: string;

  // Section 2 — Verdict
  verdict: "Go" | "Conditional Go" | "No-Go" | "Insufficient Evidence";
  verdictExplanation: string;
  bestTargetPopulation: string;
  bestProgramOpportunity: string;
  largestBlocker: string;
  primaryNextAction: string;

  // Section 3 — Scorecard
  overallScore: number | null;
  confidence: "high" | "medium" | "low" | "insufficient_data";
  scorecard: ScorecardCategory[];

  // Section 4 — Demographics
  primaryDemographics: DemographicMetric[];  // max 6 shown up front
  allDemographics: DemographicMetric[];

  // Section 5 — Programs
  programs: ProgramOpportunity[];

  // Section 6 — Economics
  fmrBenchmarks: { label: string; usd: number }[];  // studio/1BR/2BR/3BR/4BR
  economicsScenarios: EconomicsScenario[];
  economicsConclusion: string;

  // Section 7 — Barriers
  barriers: Barrier[];

  // Section 8 — Launch strategy
  launchSteps: LaunchStep[];
  primaryNextActionButton: string;

  // Section 9 — Sources
  sources: ReportSource[];
}

// ─── Export input ─────────────────────────────────────────────────────────────

export interface ExportInput {
  report: MarketReportSnapshot;
  exportedAt: string; // ISO — set at request time, never from snapshot
  onlineReportUrl?: string; // URL of the live online report for accessibility reference
}

// ─── Filename params ──────────────────────────────────────────────────────────

export interface FilenameParams {
  city: string;
  stateAbbr: string;
  targetPopulation: string;
  version: number;
  generatedAt: string; // ISO date string
  format: "pdf" | "xlsx";
}
