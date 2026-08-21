/**
 * Market Intelligence types.
 * Server-only. Never import in client components.
 */

export interface GeoContext {
  city: string;
  stateAbbr: string;
  stateFips: string;
  county: string | null;
  metro: string | null;
  fmrArea: string | null;
  cocId: string | null;
  cocName: string | null;
  phaName: string | null;
}

export type SourceStatus = "ok" | "not_verified" | "partial";

export interface SourceRecord {
  sourceKey: string;
  sourceAgency: string;
  datasetName: string;
  directUrl: string | null;
  reportingPeriod: string;
  geography: string;
  retrievedAt: string;
  retrievalMethod: "api" | "csv_parse" | "web_fetch" | "static";
  confidence: "high" | "medium" | "low" | "not_verified";
  isDerived: boolean;
}

export interface CollectorResult<T> {
  data: T | null;
  status: SourceStatus;
  source: SourceRecord;
  error?: string;
}

export interface PitData {
  totalHomeless: number | null;
  unsheltered: number | null;
  adultsWithoutChildren: number | null;
  veterans: number | null;
  chronicHomeless: number | null;
  blackHomeless: number | null;
  blackPct: number | null;
  reportingYear: number;
  veterans2026Estimate: number | null;
}

export interface FmrData {
  studio: number;
  oneBr: number;
  twoBr: number;
  threeBr: number;
  fourBr: number;
  fmrYear: string;
  fmrArea: string;
}

export interface CensusData {
  totalPopulation: number | null;
  blackPopulationPct: number | null;
  medianHouseholdIncome: number | null;
  povertyRatePct: number | null;
  acsVintage: string;
}

export interface ZipDemographicData {
  zipCode: string;
  civilianPopulation18Plus: number | null;
  veteranPopulation: number | null;
  veteranPct: number | null;
  povertyRatePct: number | null;
  acsVintage: string;
}

export interface RentCastMarketData {
  medianRent: number | null;
  avgDaysOnMarket: number | null;
  activeListingsCount: number | null;
  sampleListings: Array<{
    address: string;
    zipCode: string | null;
    propertyType: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    rent: number | null;
    daysOnMarket: number | null;
  }>;
}

export interface VaProgramData {
  programs: Array<{
    programName: string;
    fitRank: "Best Immediate" | "Possible" | "Future/Constrained";
    localAdminOrg: string | null;
    sharedHousingCompatibility: string;
    referralProcess: string | null;
    currentAvailability: string;
    unresolvedRestrictions: string | null;
    sourceKey: string;
    reportingDate: string;
  }>;
}

export interface IncomeLimitsData {
  medianIncome: number | null;
  il50_p1: number | null;
  il80_p1: number | null;
  areaName: string;
  reportingYear: string;
}

export interface ChasData {
  totalOccupied: number | null;
  renterCostBurdened30pct: number | null;
  renterCostBurdened50pct: number | null;
  renterHousingProblems: number | null;
  reportingPeriod: string;
  geography: string;
}

export interface CollectedData {
  geo: GeoContext;
  pit: CollectorResult<PitData>;
  fmr: CollectorResult<FmrData>;
  census: CollectorResult<CensusData>;
  zipDemographics: CollectorResult<ZipDemographicData[]>;
  rentcast: CollectorResult<RentCastMarketData>;
  vaPrograms: CollectorResult<VaProgramData>;
  incomeLimits: CollectorResult<IncomeLimitsData>;
  chas: CollectorResult<ChasData>;
  collectedAt: string;
}

export interface ScorecardItem {
  key: string;
  label: string;
  numericScore: number | null;
  band: "High" | "Medium" | "Low" | "Unknown";
  weight: number;
  weightedContribution: number | null;
  reason: string;
  missingEvidence: string | null;
}

export interface ScoringResult {
  overallScore: number | null;
  confidence: "high" | "medium" | "low" | "insufficient_data";
  verdict: "Go" | "Conditional Go" | "No-Go" | "Insufficient Evidence";
  verdictExplanation: string;
  scorecard: ScorecardItem[];
  bestTargetPopulation: string;
  bestProgramOpportunity: string;
  largestBlocker: string;
  primaryNextAction: string;
  primaryNextActionButton: string;
}

export interface JobRow {
  id: string;
  organizationId: string;
  projectId: string;
  status: string;
  triggeredBy: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
  sourcesSummary: string | null;
  createdAt: Date;
}

export interface ReportRow {
  id: string;
  organizationId: string;
  projectId: string;
  jobId: string | null;
  version: number;
  status: string;
  reportJson: string;
  generatedAt: Date;
  dataThroughDate: string;
  createdAt: Date;
}
