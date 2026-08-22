"server-only";
/**
 * FHF Property Opportunity Engine V1
 * Deterministic ZIP/metro-level scoring: "Where should FHF look for property?"
 *
 * Formula (0-100):
 *   Veteran Housing Need     x 0.40  -> 0-40 pts
 *   Placement Infrastructure x 0.20  -> 0-20 pts
 *   Housing Economics        x 0.25  -> 0-25 pts
 *   Property Availability    x 0.15  -> 0-15 pts
 *
 * Priority levels: >=80 PRIORITY | 65-79 STRONG | 50-64 WATCH | <50 LOW
 * Confidence: HIGH (verified PIT+FMR) | MEDIUM (partial) | ESTIMATED (proxy)
 *
 * V1 geographic resolution: CoC/Metro level.
 * ZIP-level granularity pending: HUD ZIP PIT, Census ZIP tabulation, SSVF ZIP map.
 *
 * Pure function - no DB, no network.
 */
import type { CollectedData } from "@/lib/market-intelligence/types";

export const OPPORTUNITY_ENGINE_VERSION = "FHF-OPPORTUNITY-V1";

export type PriorityLevel = "PRIORITY" | "STRONG" | "WATCH" | "LOW";
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "ESTIMATED";
export type SourceGeographyType = "zip" | "city" | "county" | "coc" | "metro";
export type InputType = "veteran_need" | "placement_infra" | "housing_economics" | "property_availability";

export interface ZipOpportunityInput {
  inputType: InputType;
  inputName: string;
  rawValue: number | string | null;
  normalizedValue: number | null;
  source: string;
  sourceDate: string;
  geography: string;
  isEstimated: boolean;
}

export interface ZipOpportunityScore {
  zipCode: string;
  rank: number;
  veteranNeedIndex: number;
  placementInfraIndex: number;
  housingEconomicsIndex: number;
  propertyAvailIndex: number;
  veteranNeedScore: number;
  placementInfraScore: number;
  housingEconomicsScore: number;
  propertyAvailScore: number;
  opportunityScore: number;
  priorityLevel: PriorityLevel;
  confidenceLevel: ConfidenceLevel;
  sourceGeography: string;
  sourceGeographyType: SourceGeographyType;
  isEstimated: boolean;
  recommendation: string;
  inputs: ZipOpportunityInput[];
  calculatedAt: string;
  calculationVersion: string;
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, isNaN(v) ? 0 : v));
}

function toPriorityLevel(score: number): PriorityLevel {
  if (score >= 80) return "PRIORITY";
  if (score >= 65) return "STRONG";
  if (score >= 50) return "WATCH";
  return "LOW";
}

function makeInput(
  inputType: InputType,
  inputName: string,
  rawValue: number | string | null,
  normalizedValue: number | null,
  source: string,
  geography: string,
  isEstimated: boolean,
): ZipOpportunityInput {
  return { inputType, inputName, rawValue, normalizedValue, source, sourceDate: new Date().toISOString().slice(0, 10), geography, isEstimated };
}

// ─── Veteran Need (40%) ───────────────────────────────────────────────────────
// Homelessness Pressure 40% + Veteran Concentration 30% + Economic Vulnerability 20% + Housing Stress 10%

function scoreVeteranNeed(data: CollectedData): { index: number; inputs: ZipOpportunityInput[]; isEstimated: boolean } {
  const inputs: ZipOpportunityInput[] = [];
  const geo = `${data.geo.city}, ${data.geo.stateAbbr}`;
  const geoLabel = data.geo.cocId ?? geo;
  const pit = data.pit.data;
  const census = data.census.data;

  // Homelessness pressure
  let pressureScore = 50;
  let pressureEst = true;
  if (pit && pit.totalHomeless !== null) {
    const pop = census?.totalPopulation;
    if (pop && pop > 0) {
      const rate = (pit.totalHomeless / pop) * 10000;
      if (rate >= 60) pressureScore = 95;
      else if (rate >= 40) pressureScore = 85;
      else if (rate >= 25) pressureScore = 72;
      else if (rate >= 15) pressureScore = 58;
      else if (rate >= 8) pressureScore = 45;
      else pressureScore = 32;
      pressureEst = data.pit.source.isDerived;
      inputs.push(makeInput("veteran_need", "Homeless rate per 10k", rate, pressureScore, "HUD PIT + Census ACS", geoLabel, pressureEst));
    } else {
      if (pit.totalHomeless >= 5000) pressureScore = 90;
      else if (pit.totalHomeless >= 2000) pressureScore = 78;
      else if (pit.totalHomeless >= 1000) pressureScore = 65;
      else if (pit.totalHomeless >= 500) pressureScore = 52;
      else pressureScore = 38;
      pressureEst = data.pit.source.isDerived;
      inputs.push(makeInput("veteran_need", "Homeless count", pit.totalHomeless, pressureScore, "HUD PIT", geoLabel, pressureEst));
    }
  } else if (census?.povertyRatePct != null) {
    const pct = census.povertyRatePct * 100;
    pressureScore = pct >= 25 ? 70 : pct >= 18 ? 60 : pct >= 12 ? 50 : 38;
    pressureEst = true;
    inputs.push(makeInput("veteran_need", "Poverty rate proxy (no PIT) %", pct, pressureScore, "Census ACS", geo, true));
  } else {
    inputs.push(makeInput("veteran_need", "Homelessness pressure (unavailable)", null, null, "unavailable", geo, true));
  }

  // Veteran concentration
  let vetScore = 50;
  let vetEst = true;
  if (pit && pit.veterans !== null && pit.totalHomeless !== null && pit.totalHomeless > 0) {
    const count = pit.veterans2026Estimate ?? pit.veterans;
    const pct = count / pit.totalHomeless;
    if (pct >= 0.15) vetScore = 90;
    else if (pct >= 0.10) vetScore = 78;
    else if (pct >= 0.08) vetScore = 65;
    else if (pct >= 0.05) vetScore = 52;
    else vetScore = 38;
    vetEst = data.pit.source.isDerived;
    inputs.push(makeInput("veteran_need", "Veterans % of homeless", pct * 100, vetScore, "HUD PIT", geoLabel, vetEst));
    inputs.push(makeInput("veteran_need", "Homeless veteran count", count, null, "HUD PIT", geoLabel, vetEst));
  } else {
    inputs.push(makeInput("veteran_need", "Veteran concentration (unavailable)", null, null, "unavailable", geo, true));
  }

  // Economic vulnerability
  let vulnScore = 50;
  let vulnEst = true;
  if (census?.povertyRatePct != null) {
    const pct = census.povertyRatePct * 100;
    if (pct >= 25) vulnScore = 88;
    else if (pct >= 18) vulnScore = 74;
    else if (pct >= 12) vulnScore = 60;
    else if (pct >= 8) vulnScore = 46;
    else vulnScore = 32;
    vulnEst = data.census.source.isDerived;
    inputs.push(makeInput("veteran_need", "Area poverty rate %", pct, vulnScore, "Census ACS", geo, vulnEst));
  } else {
    inputs.push(makeInput("veteran_need", "Economic vulnerability (unavailable)", null, null, "unavailable", geo, true));
  }

  // Housing stress
  let stressScore = 50;
  let stressEst = true;
  const chas = data.chas.data;
  if (chas?.totalOccupied && chas.totalOccupied > 0 && chas.renterCostBurdened30pct != null) {
    const share = chas.renterCostBurdened30pct / chas.totalOccupied;
    if (share >= 0.40) stressScore = 90;
    else if (share >= 0.30) stressScore = 75;
    else if (share >= 0.20) stressScore = 58;
    else stressScore = 42;
    stressEst = data.chas.source.isDerived;
    inputs.push(makeInput("veteran_need", "Renter cost-burden rate >30% (%)", share * 100, stressScore, "HUD CHAS", chas.geography, stressEst));
  } else {
    inputs.push(makeInput("veteran_need", "Housing stress (unavailable)", null, null, "unavailable", geo, true));
  }

  const index = clamp(pressureScore * 0.40 + vetScore * 0.30 + vulnScore * 0.20 + stressScore * 0.10);
  return { index, inputs, isEstimated: pressureEst || vetEst };
}

// ─── Placement Infrastructure (20%) ──────────────────────────────────────────
// SSVF 35% + HUD-VASH 30% + VA access 20% + FHF partner 15% (always neutral 50)

function scorePlacementInfra(data: CollectedData): { index: number; inputs: ZipOpportunityInput[]; isEstimated: boolean } {
  const inputs: ZipOpportunityInput[] = [];
  const geo = `${data.geo.city}, ${data.geo.stateAbbr}`;
  const programs = data.vaPrograms.data?.programs ?? [];

  const ssvf = programs.find((p) => p.programName.startsWith("SSVF"));
  let ssvfScore = 50;
  if (ssvf?.fitRank === "Best Immediate") ssvfScore = 85;
  else if (ssvf?.fitRank === "Possible") ssvfScore = 65;
  inputs.push(makeInput("placement_infra", "SSVF coverage", ssvf?.fitRank ?? "Not verified", ssvfScore, "VA SSVF Directory", geo, ssvf == null));

  const hudvash = programs.find((p) => p.programName.startsWith("HUD-VASH"));
  let hudvashScore = 50;
  if (hudvash?.fitRank === "Best Immediate") hudvashScore = 85;
  else if (hudvash?.fitRank === "Possible") hudvashScore = 65;
  inputs.push(makeInput("placement_infra", "HUD-VASH coverage", hudvash?.fitRank ?? "Not verified", hudvashScore, "VA HUD-VASH Program", geo, hudvash == null));

  const vaScore = data.geo.cocId ? 72 : (data.geo.metro ? 62 : 50);
  inputs.push(makeInput("placement_infra", "VA facility access", data.geo.cocId ?? data.geo.metro ?? "Unknown", vaScore, "HUD CoC Registry", geo, !data.geo.cocId));

  inputs.push(makeInput("placement_infra", "FHF referral partners (new market - neutral)", "No operating history", 50, "FHF internal", geo, false));

  const index = clamp(ssvfScore * 0.35 + hudvashScore * 0.30 + vaScore * 0.20 + 50 * 0.15);
  return { index, inputs, isEstimated: ssvf == null || hudvash == null };
}

// ─── Housing Economics (25%) ──────────────────────────────────────────────────
// Coverage Ratio via FMR. Revenue = 3 rooms x FMR 1BR. Cost = FMR 4BR x 1.05.

function scoreHousingEconomics(data: CollectedData): { index: number; inputs: ZipOpportunityInput[]; isEstimated: boolean } {
  const inputs: ZipOpportunityInput[] = [];
  const geo = `${data.geo.city}, ${data.geo.stateAbbr}`;
  const fmr = data.fmr.data;

  if (!fmr) {
    inputs.push(makeInput("housing_economics", "FMR data", null, null, "HUD FMR API - unavailable", geo, true));
    return { index: 50, inputs, isEstimated: true };
  }

  const usableRooms = 3;
  const paymentPerRoom = fmr.oneBr;
  const revenue = usableRooms * paymentPerRoom;
  const cost = fmr.fourBr * 1.05;
  const ratio = cost > 0 ? revenue / cost : 0;

  let idx: number;
  if (ratio >= 1.40) idx = 100;
  else if (ratio >= 1.30) idx = 90;
  else if (ratio >= 1.20) idx = 80;
  else if (ratio >= 1.10) idx = 65;
  else if (ratio >= 1.00) idx = 50;
  else idx = 20;

  const isEstimated = data.fmr.source.isDerived;
  const fmrGeo = data.geo.fmrArea ?? geo;
  inputs.push(makeInput("housing_economics", "FMR 1BR per-room payment proxy", fmr.oneBr, null, "HUD FMR", fmrGeo, isEstimated));
  inputs.push(makeInput("housing_economics", "FMR 4BR property cost benchmark", fmr.fourBr, null, "HUD FMR", fmrGeo, isEstimated));
  inputs.push(makeInput("housing_economics", "Est. monthly revenue (3 rooms x 1BR FMR)", revenue, null, "HUD FMR derived", geo, isEstimated));
  inputs.push(makeInput("housing_economics", "Est. monthly cost (4BR FMR x 1.05)", cost, null, "HUD FMR derived", geo, isEstimated));
  inputs.push(makeInput("housing_economics", "Coverage ratio", ratio, clamp(idx), "HUD FMR derived", geo, isEstimated));

  return { index: clamp(idx), inputs, isEstimated };
}

// ─── Property Availability (15%) ─────────────────────────────────────────────
// Inventory Depth 40% + Affordability 35% + Room Config 25%

function scorePropertyAvailability(data: CollectedData): { index: number; inputs: ZipOpportunityInput[]; isEstimated: boolean } {
  const inputs: ZipOpportunityInput[] = [];
  const geo = `${data.geo.city}, ${data.geo.stateAbbr}`;
  const rc = data.rentcast.data;
  const fmr = data.fmr.data;

  let depthScore = 45;
  let depthEst = true;
  if (rc) {
    depthEst = false;
    const count = rc.activeListingsCount ?? 0;
    if (count > 10) depthScore = 80;
    else if (count >= 5) depthScore = 65;
    else if (rc.medianRent !== null) depthScore = 55;
    inputs.push(makeInput("property_availability", "Active 4BR listings", count, depthScore, "RentCast", geo, false));
  } else {
    inputs.push(makeInput("property_availability", "Active listings (RentCast unavailable)", null, depthScore, "unavailable", geo, true));
  }

  let affordScore = 50;
  let affordEst = true;
  if (fmr && rc?.medianRent != null) {
    const headroom = fmr.fourBr - rc.medianRent;
    if (headroom > 500) affordScore = 82;
    else if (headroom > 200) affordScore = 68;
    else if (headroom > 0) affordScore = 55;
    else affordScore = 25;
    affordEst = data.fmr.source.isDerived;
    inputs.push(makeInput("property_availability", "FMR vs median rent headroom $", headroom, affordScore, "HUD FMR + RentCast", geo, affordEst));
  } else if (fmr) {
    affordScore = 55;
    affordEst = data.fmr.source.isDerived;
    inputs.push(makeInput("property_availability", "FMR benchmark (no market rent)", fmr.fourBr, affordScore, "HUD FMR", data.geo.fmrArea ?? geo, affordEst));
  } else {
    inputs.push(makeInput("property_availability", "Affordability (FMR unavailable)", null, affordScore, "unavailable", geo, true));
  }

  let roomScore = 50;
  let roomIsEstimated = true;
  if (rc?.sampleListings && rc.sampleListings.length > 0) {
    const multi = rc.sampleListings.filter((l) => (l.bedrooms ?? 0) >= 3).length;
    if (multi >= 3) roomScore = 80;
    else if (multi >= 1) roomScore = 65;
    else roomScore = 40;
    roomIsEstimated = false;
    inputs.push(makeInput("property_availability", "Sample listings >=3BR count", multi, roomScore, "RentCast", geo, false));
  } else {
    inputs.push(makeInput("property_availability", "Room config (no sample data)", null, roomScore, "unavailable", geo, true));
  }

  const index = clamp(depthScore * 0.40 + affordScore * 0.35 + roomScore * 0.25);
  return { index, inputs, isEstimated: depthEst || affordEst || roomIsEstimated };
}

function buildRecommendation(pl: PriorityLevel, vetIdx: number, econIdx: number): string {
  if (pl === "PRIORITY") return "Strong Veteran housing need with favorable economics. Prioritize property search in this market.";
  if (pl === "STRONG") {
    if (econIdx < 50) return "High Veteran need but economics need verification. Confirm local payment standard before committing to a property.";
    return "Strong opportunity. Confirm SSVF/HUD-VASH referral pipeline and begin property search.";
  }
  if (pl === "WATCH") {
    if (vetIdx < 50) return "Limited verified Veteran demand data. Collect local outreach data before expanding here.";
    return "Moderate opportunity. Verify local program acceptability and refine economics with actual asking rents.";
  }
  return "Insufficient evidence or unfavorable economics at this time. Gather additional local data before proceeding.";
}

export function scoreOpportunity(data: CollectedData, zipCode = "", rank = 1): ZipOpportunityScore {
  const vn = scoreVeteranNeed(data);
  const pi = scorePlacementInfra(data);
  const he = scoreHousingEconomics(data);
  const pa = scorePropertyAvailability(data);

  const vnScore = clamp(vn.index * 0.40, 0, 40);
  const piScore = clamp(pi.index * 0.20, 0, 20);
  const heScore = clamp(he.index * 0.25, 0, 25);
  const paScore = clamp(pa.index * 0.15, 0, 15);

  const opportunityScore = clamp(Math.round(vnScore + piScore + heScore + paScore));
  const pl = toPriorityLevel(opportunityScore);
  const isEstimated = vn.isEstimated || pi.isEstimated || he.isEstimated || pa.isEstimated;

  const hasVerifiedPit = data.pit.status === "ok" && !data.pit.source.isDerived;
  const hasVerifiedFmr = data.fmr.status === "ok" && !data.fmr.source.isDerived;
  let confidenceLevel: ConfidenceLevel = "ESTIMATED";
  if (hasVerifiedPit && hasVerifiedFmr) confidenceLevel = "HIGH";
  else if (hasVerifiedPit || hasVerifiedFmr) confidenceLevel = "MEDIUM";

  const sourceGeoType: SourceGeographyType = data.geo.cocId ? "coc" : "city";
  const sourceGeo = data.geo.cocId ? `${data.geo.cocId} (${data.geo.cocName ?? data.geo.city})` : `${data.geo.city}, ${data.geo.stateAbbr}`;

  return {
    zipCode,
    rank,
    veteranNeedIndex: Math.round(vn.index * 100) / 100,
    placementInfraIndex: Math.round(pi.index * 100) / 100,
    housingEconomicsIndex: Math.round(he.index * 100) / 100,
    propertyAvailIndex: Math.round(pa.index * 100) / 100,
    veteranNeedScore: Math.round(vnScore * 100) / 100,
    placementInfraScore: Math.round(piScore * 100) / 100,
    housingEconomicsScore: Math.round(heScore * 100) / 100,
    propertyAvailScore: Math.round(paScore * 100) / 100,
    opportunityScore,
    priorityLevel: pl,
    confidenceLevel,
    sourceGeography: sourceGeo,
    sourceGeographyType: sourceGeoType,
    isEstimated,
    recommendation: buildRecommendation(pl, vn.index, he.index),
    inputs: [...vn.inputs, ...pi.inputs, ...he.inputs, ...pa.inputs],
    calculatedAt: new Date().toISOString(),
    calculationVersion: OPPORTUNITY_ENGINE_VERSION,
  };
}
