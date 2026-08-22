import "server-only";

import type { CollectedData, FmrData } from "@/lib/market-intelligence/types";
import type { OpportunityScoreInputSnapshot, ZipOpportunityRanking } from "@/lib/export/types";

const VERSION = "FHF-OPPORTUNITY-V1.2";

type Listing = NonNullable<CollectedData["rentcast"]["data"]>["sampleListings"][number];

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : 0));
const r2 = (n: number) => Math.round(n * 100) / 100;

function priority(score: number): ZipOpportunityRanking["priorityLevel"] {
  return score >= 80 ? "PRIORITY" : score >= 65 ? "STRONG" : score >= 50 ? "WATCH" : "LOW";
}

function input(
  key: string,
  rawValue: number | string | null,
  normalizedValue: number | null,
  source: string,
  geography: string,
  isEstimated: boolean,
): OpportunityScoreInputSnapshot {
  return { key, rawValue, normalizedValue, source, geography, isEstimated };
}

function fmrForBedrooms(fmr: FmrData, bedrooms: number): number {
  if (bedrooms <= 1) return fmr.oneBr;
  if (bedrooms === 2) return fmr.twoBr;
  if (bedrooms === 3) return fmr.threeBr;
  return fmr.fourBr;
}

function ratioIndex(ratio: number): number {
  return ratio >= 1.20 ? 95 : ratio >= 1.10 ? 85 : ratio >= 1.00 ? 72 : ratio >= 0.90 ? 58 : ratio >= 0.80 ? 42 : 25;
}

function regionalVeteranNeed(data: CollectedData): { index: number; inputs: OpportunityScoreInputSnapshot[] } {
  const inputs: OpportunityScoreInputSnapshot[] = [];
  const cityGeo = `${data.geo.city}, ${data.geo.stateAbbr}`;
  const pitGeo = data.geo.cocId ? `${data.geo.cocId} ${data.geo.cocName ?? ""}`.trim() : cityGeo;
  const veterans = data.pit.data ? (data.pit.data.veterans2026Estimate ?? data.pit.data.veterans) : null;
  const population = data.census.data?.totalPopulation ?? null;

  let pressure = 50;
  if (veterans !== null && veterans !== undefined && population && population > 0) {
    const per100k = (veterans / population) * 100000;
    pressure = per100k >= 50 ? 95 : per100k >= 30 ? 85 : per100k >= 20 ? 72 : per100k >= 10 ? 58 : per100k >= 5 ? 45 : 32;
    inputs.push(input("regional_homeless_veterans", veterans, null, "HUD PIT", pitGeo, data.pit.source.isDerived));
    inputs.push(input("regional_homeless_veterans_per_100k", r2(per100k), pressure, "HUD PIT + Census ACS", pitGeo, true));
  } else if (veterans !== null && veterans !== undefined) {
    pressure = veterans >= 500 ? 90 : veterans >= 250 ? 78 : veterans >= 100 ? 65 : veterans >= 50 ? 52 : 38;
    inputs.push(input("regional_homeless_veterans", veterans, pressure, "HUD PIT", pitGeo, data.pit.source.isDerived));
  } else {
    inputs.push(input("regional_homeless_veteran_pressure", null, 50, "Unavailable — neutral", pitGeo, true));
  }

  const poverty = data.census.data?.povertyRatePct ?? null;
  const vulnerability = poverty === null
    ? 50
    : poverty >= 0.25 ? 88
    : poverty >= 0.18 ? 74
    : poverty >= 0.12 ? 60
    : poverty >= 0.08 ? 46
    : 32;
  inputs.push(input("city_poverty_rate", poverty === null ? null : r2(poverty * 100), vulnerability, "Census ACS", cityGeo, poverty === null));

  let housingStress = 50;
  let housingStressRaw: number | null = null;
  const chas = data.chas.data;
  if (chas?.totalOccupied && chas.totalOccupied > 0 && chas.renterCostBurdened30pct != null) {
    housingStressRaw = chas.renterCostBurdened30pct / chas.totalOccupied;
    housingStress = housingStressRaw >= 0.40 ? 90 : housingStressRaw >= 0.30 ? 75 : housingStressRaw >= 0.20 ? 58 : 42;
  }
  inputs.push(input("regional_housing_cost_burden", housingStressRaw === null ? null : r2(housingStressRaw * 100), housingStress, "HUD CHAS", chas?.geography ?? data.geo.county ?? cityGeo, true));

  // No ZIP-level veteran concentration exists in fallback mode, so keep that component neutral.
  const veteranConcentrationNeutral = 50;
  inputs.push(input("zip_veteran_concentration", null, veteranConcentrationNeutral, "Unavailable at fallback geography — neutral", cityGeo, true));

  return {
    index: clamp(pressure * 0.40 + veteranConcentrationNeutral * 0.30 + vulnerability * 0.20 + housingStress * 0.10),
    inputs,
  };
}

function placementInfrastructure(data: CollectedData): { index: number; inputs: OpportunityScoreInputSnapshot[] } {
  const programs = data.vaPrograms.data?.programs ?? [];
  const fit = (prefix: string) => {
    const row = programs.find((p) => p.programName.startsWith(prefix));
    return row?.fitRank === "Best Immediate" ? 85 : row?.fitRank === "Possible" ? 65 : 50;
  };
  const ssvf = fit("SSVF");
  const hudVash = fit("HUD-VASH");
  const vaAccess = data.geo.cocId ? 72 : data.geo.metro ? 62 : 50;
  const geography = `${data.geo.city}, ${data.geo.stateAbbr}`;
  return {
    index: clamp(ssvf * 0.35 + hudVash * 0.30 + vaAccess * 0.20 + 50 * 0.15),
    inputs: [
      input("ssvf_coverage", programs.find((p) => p.programName.startsWith("SSVF"))?.fitRank ?? "Not verified", ssvf, "VA SSVF", geography, ssvf === 50),
      input("hud_vash_coverage", programs.find((p) => p.programName.startsWith("HUD-VASH"))?.fitRank ?? "Not verified", hudVash, "VA HUD-VASH", geography, hudVash === 50),
      input("va_access", data.geo.cocId ?? data.geo.metro ?? "Unknown", vaAccess, "FHF geography resolver", geography, !data.geo.cocId),
      input("fhf_partner_history", "New-market neutral", 50, "FHF internal", geography, false),
    ],
  };
}

function regionalEconomics(data: CollectedData, listings: Listing[]): { index: number; inputs: OpportunityScoreInputSnapshot[] } {
  const geography = `${data.geo.city}, ${data.geo.stateAbbr}`;
  const fmr = data.fmr.data;
  const scored = listings
    .filter((listing) => fmr && typeof listing.rent === "number" && listing.rent > 0 && typeof listing.bedrooms === "number" && listing.bedrooms > 0)
    .map((listing) => {
      const bedrooms = listing.bedrooms as number;
      const rent = listing.rent as number;
      const benchmark = fmrForBedrooms(fmr as FmrData, bedrooms);
      const ratio = benchmark > 0 ? benchmark / rent : 0;
      return { ratio, score: ratioIndex(ratio), rent, bedrooms };
    });

  if (!scored.length) {
    return {
      index: 50,
      inputs: [
        input("regional_housing_economics_screen", null, 50, "Unavailable — neutral", geography, true),
        input("payment_standard_status", "Not confirmed — FMR is never treated as per-room payment", null, "FHF rule", geography, true),
      ],
    };
  }

  const scores = scored.map((row) => row.score).sort((a, b) => a - b);
  const ratios = scored.map((row) => row.ratio).sort((a, b) => a - b);
  const rents = scored.map((row) => row.rent).sort((a, b) => a - b);
  const indexValue = scores[Math.floor(scores.length / 2)];
  return {
    index: clamp(indexValue),
    inputs: [
      input("regional_listing_count_used_for_economics", scored.length, null, "RentCast", geography, false),
      input("regional_median_asking_rent", rents[Math.floor(rents.length / 2)], null, "RentCast", geography, false),
      input("regional_median_matching_fmr_to_rent_ratio", r2(ratios[Math.floor(ratios.length / 2)]), indexValue, "HUD FMR + RentCast", geography, true),
      input("payment_standard_status", "Not confirmed — FMR used only as screening benchmark", null, "FHF rule", geography, true),
    ],
  };
}

function regionalPropertyAvailability(data: CollectedData, listings: Listing[]): { index: number; inputs: OpportunityScoreInputSnapshot[] } {
  const geography = `${data.geo.city}, ${data.geo.stateAbbr}`;
  if (!listings.length) {
    return { index: 35, inputs: [input("qualifying_inventory", 0, 35, "RentCast unavailable/no usable listings", geography, true)] };
  }

  const count = data.rentcast.data?.activeListingsCount ?? listings.length;
  const depth = count >= 20 ? 90 : count >= 10 ? 78 : count >= 5 ? 65 : count >= 1 ? 52 : 35;
  const roomScores = listings.map((listing) => {
    const bedrooms = listing.bedrooms ?? 0;
    return bedrooms >= 5 ? 95 : bedrooms >= 4 ? 82 : bedrooms >= 3 ? 62 : 30;
  });
  const roomConfiguration = roomScores.reduce((sum, score) => sum + score, 0) / roomScores.length;
  const affordability = 50; // Economics is scored separately; no ZIP-level rent distribution exists here.
  return {
    index: clamp(depth * 0.40 + affordability * 0.35 + roomConfiguration * 0.25),
    inputs: [
      input("regional_active_listings", count, depth, "RentCast", geography, false),
      input("regional_affordability_component", null, affordability, "Fallback mode — neutral", geography, true),
      input("regional_room_configuration", r2(roomConfiguration), roomConfiguration, "RentCast bedrooms", geography, false),
    ],
  };
}

export function scoreRegionalFallbackOpportunity(data: CollectedData): ZipOpportunityRanking {
  const listings = data.rentcast.data?.sampleListings ?? [];
  const need = regionalVeteranNeed(data);
  const placement = placementInfrastructure(data);
  const economics = regionalEconomics(data, listings);
  const properties = regionalPropertyAvailability(data, listings);

  const veteranNeedScore = need.index * 0.40;
  const placementInfraScore = placement.index * 0.20;
  const housingEconomicsScore = economics.index * 0.25;
  const propertyAvailScore = properties.index * 0.15;
  const total = Math.round(clamp(veteranNeedScore + placementInfraScore + housingEconomicsScore + propertyAvailScore));
  const level = priority(total);

  const sourceGeographyType = data.geo.cocId ? "coc" : data.geo.county ? "county" : data.geo.metro ? "metro" : "city";
  const sourceGeography = data.geo.cocId
    ? `${data.geo.cocId} (${data.geo.cocName ?? data.geo.city}) + ${data.geo.city}, ${data.geo.stateAbbr}`
    : `${data.geo.city}, ${data.geo.stateAbbr}`;

  return {
    zipCode: "",
    rank: 1,
    label: "City / CoC Fallback",
    veteranNeedIndex: r2(need.index),
    veteranNeedScore: r2(veteranNeedScore),
    placementInfraIndex: r2(placement.index),
    placementInfraScore: r2(placementInfraScore),
    housingEconomicsIndex: r2(economics.index),
    housingEconomicsScore: r2(housingEconomicsScore),
    propertyAvailIndex: r2(properties.index),
    propertyAvailScore: r2(propertyAvailScore),
    opportunityScore: total,
    priorityLevel: level,
    confidenceLevel: "ESTIMATED",
    isEstimated: true,
    sourceGeography,
    sourceGeographyType,
    recommendation: "ZIP-level ranking was unavailable for this run. Use this broader market score as a fallback and continue property search while ZIP data refreshes.",
    calculationVersion: VERSION,
    inputs: [...need.inputs, ...placement.inputs, ...economics.inputs, ...properties.inputs],
  };
}
