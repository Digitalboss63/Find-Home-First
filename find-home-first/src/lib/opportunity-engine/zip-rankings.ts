import "server-only";

import type { CollectedData, FmrData, ZipDemographicData } from "@/lib/market-intelligence/types";
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

function placement(data: CollectedData): { index: number; inputs: OpportunityScoreInputSnapshot[] } {
  const programs = data.vaPrograms.data?.programs ?? [];
  const fit = (prefix: string) => {
    const row = programs.find((p) => p.programName.startsWith(prefix));
    return row?.fitRank === "Best Immediate" ? 85 : row?.fitRank === "Possible" ? 65 : 50;
  };
  const ssvf = fit("SSVF");
  const hudVash = fit("HUD-VASH");
  const vaAccess = data.geo.cocId ? 72 : data.geo.metro ? 62 : 50;
  const partnerNeutral = 50;
  const geography = `${data.geo.city}, ${data.geo.stateAbbr}`;
  return {
    index: clamp(ssvf * 0.35 + hudVash * 0.30 + vaAccess * 0.20 + partnerNeutral * 0.15),
    inputs: [
      input("ssvf_coverage", programs.find((p) => p.programName.startsWith("SSVF"))?.fitRank ?? "Not verified", ssvf, "VA SSVF", geography, ssvf === 50),
      input("hud_vash_coverage", programs.find((p) => p.programName.startsWith("HUD-VASH"))?.fitRank ?? "Not verified", hudVash, "VA HUD-VASH", geography, hudVash === 50),
      input("va_access", data.geo.cocId ?? data.geo.metro ?? "Unknown", vaAccess, "FHF geography resolver", geography, !data.geo.cocId),
      input("fhf_partner_history", "New-market neutral", partnerNeutral, "FHF internal", geography, false),
    ],
  };
}

/** Regional Veteran homelessness pressure. It is intentionally NOT presented as a ZIP count. */
function veteranHomelessnessPressure(data: CollectedData): { score: number; inputs: OpportunityScoreInputSnapshot[] } {
  const pit = data.pit.data;
  const geography = data.geo.cocId ? `${data.geo.cocId} ${data.geo.cocName ?? ""}`.trim() : `${data.geo.city}, ${data.geo.stateAbbr}`;
  const veterans = pit ? (pit.veterans2026Estimate ?? pit.veterans) : null;
  const population = data.census.data?.totalPopulation ?? null;

  if (veterans !== null && veterans !== undefined && population && population > 0) {
    const per100k = (veterans / population) * 100000;
    const score = per100k >= 50 ? 95 : per100k >= 30 ? 85 : per100k >= 20 ? 72 : per100k >= 10 ? 58 : per100k >= 5 ? 45 : 32;
    return {
      score,
      inputs: [
        input("regional_homeless_veterans", veterans, null, "HUD PIT", geography, data.pit.source.isDerived),
        input("regional_homeless_veterans_per_100k", r2(per100k), score, "HUD PIT + Census ACS", geography, true),
      ],
    };
  }

  if (veterans !== null && veterans !== undefined) {
    const score = veterans >= 500 ? 90 : veterans >= 250 ? 78 : veterans >= 100 ? 65 : veterans >= 50 ? 52 : 38;
    return {
      score,
      inputs: [input("regional_homeless_veterans", veterans, score, "HUD PIT", geography, data.pit.source.isDerived)],
    };
  }

  return {
    score: 50,
    inputs: [input("regional_homeless_veteran_pressure", null, 50, "Unavailable — neutral", geography, true)],
  };
}

function veteranNeed(
  data: CollectedData,
  zipCode: string,
  demographics?: ZipDemographicData,
): { index: number; inputs: OpportunityScoreInputSnapshot[] } {
  const regional = veteranHomelessnessPressure(data);
  const geography = `ZIP/ZCTA ${zipCode}`;

  const veteranPct = demographics?.veteranPct ?? null; // stored as 0..1 ratio
  const concentration = veteranPct === null
    ? 50
    : veteranPct >= 0.10 ? 90
    : veteranPct >= 0.08 ? 80
    : veteranPct >= 0.06 ? 70
    : veteranPct >= 0.04 ? 58
    : 42;

  const veteranPoverty = demographics?.povertyRatePct ?? null; // stored as 0..1 ratio
  const vulnerability = veteranPoverty === null
    ? 50
    : veteranPoverty >= 0.25 ? 88
    : veteranPoverty >= 0.18 ? 74
    : veteranPoverty >= 0.12 ? 60
    : veteranPoverty >= 0.08 ? 46
    : 32;

  let housingStress = 50;
  let housingStressRaw: number | null = null;
  const chas = data.chas.data;
  if (chas?.totalOccupied && chas.totalOccupied > 0 && chas.renterCostBurdened30pct != null) {
    housingStressRaw = chas.renterCostBurdened30pct / chas.totalOccupied;
    housingStress = housingStressRaw >= 0.40 ? 90 : housingStressRaw >= 0.30 ? 75 : housingStressRaw >= 0.20 ? 58 : 42;
  }

  const indexValue = clamp(regional.score * 0.40 + concentration * 0.30 + vulnerability * 0.20 + housingStress * 0.10);
  return {
    index: indexValue,
    inputs: [
      ...regional.inputs,
      input("zip_veteran_population", demographics?.veteranPopulation ?? null, null, "Census ACS S2101", geography, !demographics),
      input("zip_veteran_concentration", veteranPct === null ? null : r2(veteranPct * 100), concentration, "Census ACS S2101", geography, !demographics),
      input("zip_veteran_poverty_rate", veteranPoverty === null ? null : r2(veteranPoverty * 100), vulnerability, "Census ACS S2101", geography, !demographics),
      input("regional_housing_cost_burden", housingStressRaw === null ? null : r2(housingStressRaw * 100), housingStress, "HUD CHAS", chas?.geography ?? data.geo.county ?? data.geo.city, true),
    ],
  };
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

/**
 * Housing economics is a SCREENING score only until a program payment standard is confirmed.
 * It compares actual asking rent to the matching-bedroom HUD FMR benchmark. It never treats
 * FMR 1BR as the amount FHF will receive per room.
 */
function economics(data: CollectedData, zipCode: string, listings: Listing[]): { index: number; inputs: OpportunityScoreInputSnapshot[] } {
  const fmr = data.fmr.data;
  const geography = `ZIP ${zipCode}`;
  if (!fmr || !listings.length) {
    return {
      index: 50,
      inputs: [input("housing_economics_screen", null, 50, "Unavailable — neutral", geography, true)],
    };
  }

  const scored = listings
    .filter((listing) => typeof listing.rent === "number" && listing.rent > 0 && typeof listing.bedrooms === "number" && listing.bedrooms > 0)
    .map((listing) => {
      const bedrooms = listing.bedrooms as number;
      const rent = listing.rent as number;
      const benchmark = fmrForBedrooms(fmr, bedrooms);
      const ratio = benchmark > 0 ? benchmark / rent : 0;
      return { listing, bedrooms, rent, benchmark, ratio, score: ratioIndex(ratio), requiredRentPerRoom: rent / bedrooms };
    });

  if (!scored.length) {
    return {
      index: 50,
      inputs: [input("housing_economics_screen", null, 50, "No usable rent/bedroom listing data — neutral", geography, true)],
    };
  }

  const sortedScores = scored.map((row) => row.score).sort((a, b) => a - b);
  const indexValue = sortedScores[Math.floor(sortedScores.length / 2)];
  const rents = scored.map((row) => row.rent).sort((a, b) => a - b);
  const requiredPerRoom = scored.map((row) => row.requiredRentPerRoom).sort((a, b) => a - b);
  const ratios = scored.map((row) => row.ratio).sort((a, b) => a - b);

  return {
    index: clamp(indexValue),
    inputs: [
      input("zip_listing_count_used_for_economics", scored.length, null, "RentCast", geography, false),
      input("zip_median_asking_rent", rents[Math.floor(rents.length / 2)], null, "RentCast", geography, false),
      input("zip_median_rent_required_per_private_room", r2(requiredPerRoom[Math.floor(requiredPerRoom.length / 2)]), null, "RentCast derived; excludes utilities/operating costs", geography, true),
      input("zip_median_matching_fmr_to_rent_ratio", r2(ratios[Math.floor(ratios.length / 2)]), indexValue, "HUD FMR + RentCast", geography, true),
      input("payment_standard_status", "Not confirmed — FMR used only as screening benchmark", null, "FHF rule", geography, true),
    ],
  };
}

function propertyAvailability(data: CollectedData, zipCode: string, listings: Listing[]): { index: number; inputs: OpportunityScoreInputSnapshot[] } {
  const geography = `ZIP ${zipCode}`;
  if (!listings.length) {
    return { index: 35, inputs: [input("qualifying_inventory", 0, 35, "RentCast", geography, false)] };
  }

  const depth = listings.length >= 10 ? 90 : listings.length >= 6 ? 78 : listings.length >= 3 ? 65 : listings.length >= 1 ? 52 : 35;

  const fmr = data.fmr.data;
  const affordabilityScores = listings
    .filter((listing) => fmr && typeof listing.rent === "number" && listing.rent > 0 && typeof listing.bedrooms === "number" && listing.bedrooms > 0)
    .map((listing) => ratioIndex(fmrForBedrooms(fmr as FmrData, listing.bedrooms as number) / (listing.rent as number)));
  const affordability = affordabilityScores.length
    ? affordabilityScores.sort((a, b) => a - b)[Math.floor(affordabilityScores.length / 2)]
    : 50;

  const roomScores = listings.map((listing) => {
    const bedrooms = listing.bedrooms ?? 0;
    return bedrooms >= 5 ? 95 : bedrooms >= 4 ? 82 : bedrooms >= 3 ? 62 : 30;
  });
  const roomConfiguration = roomScores.reduce((sum, score) => sum + score, 0) / roomScores.length;

  const indexValue = clamp(depth * 0.40 + affordability * 0.35 + roomConfiguration * 0.25);
  return {
    index: indexValue,
    inputs: [
      input("qualifying_active_listings", listings.length, depth, "RentCast active 3+ BR single-family listings", geography, false),
      input("listing_affordability_vs_matching_fmr", listings.length, affordability, "HUD FMR + RentCast", geography, !fmr),
      input("room_configuration", r2(roomConfiguration), roomConfiguration, "RentCast bedrooms", geography, false),
    ],
  };
}

function recommendation(level: ZipOpportunityRanking["priorityLevel"]): string {
  if (level === "PRIORITY") return "Priority ZIP for property search. Verify the local program payment standard before committing to a lease.";
  if (level === "STRONG") return "Strong ZIP. Begin targeted property search and verify referral capacity and payment terms.";
  if (level === "WATCH") return "Watch ZIP. Verify economics and referral capacity before committing.";
  return "Lower priority with current evidence. Continue monitoring need and inventory.";
}

export function scoreZipOpportunities(data: CollectedData): ZipOpportunityRanking[] {
  const demographicsByZip = new Map((data.zipDemographics.data ?? []).map((row) => [row.zipCode, row]));
  const listings = data.rentcast.data?.sampleListings ?? [];
  const byZip = new Map<string, Listing[]>();

  for (const listing of listings) {
    if (!listing.zipCode || !/^\d{5}$/.test(listing.zipCode)) continue;
    const current = byZip.get(listing.zipCode) ?? [];
    current.push(listing);
    byZip.set(listing.zipCode, current);
  }

  const candidateZips = [...byZip.keys()].sort();
  if (!candidateZips.length) return [];

  const placementResult = placement(data);

  const rows = candidateZips.map((zipCode): ZipOpportunityRanking => {
    const zipListings = byZip.get(zipCode) ?? [];
    const demographics = demographicsByZip.get(zipCode);
    const needResult = veteranNeed(data, zipCode, demographics);
    const economicsResult = economics(data, zipCode, zipListings);
    const propertyResult = propertyAvailability(data, zipCode, zipListings);

    const veteranNeedScore = needResult.index * 0.40;
    const placementInfraScore = placementResult.index * 0.20;
    const housingEconomicsScore = economicsResult.index * 0.25;
    const propertyAvailScore = propertyResult.index * 0.15;
    const total = Math.round(clamp(veteranNeedScore + placementInfraScore + housingEconomicsScore + propertyAvailScore));
    const level = priority(total);

    // Public-data ZIP need is modeled: regional PIT/CHAS + ZIP ACS. It is never HIGH-confidence observed ZIP homelessness.
    const strongPublicInputs = Boolean(demographics)
      && data.zipDemographics.status === "ok"
      && data.pit.status === "ok"
      && data.rentcast.status === "ok"
      && data.fmr.status === "ok";
    const confidence: ZipOpportunityRanking["confidenceLevel"] = strongPublicInputs ? "MEDIUM" : "ESTIMATED";

    return {
      zipCode,
      rank: 0,
      label: zipCode,
      veteranNeedIndex: r2(needResult.index),
      veteranNeedScore: r2(veteranNeedScore),
      placementInfraIndex: r2(placementResult.index),
      placementInfraScore: r2(placementInfraScore),
      housingEconomicsIndex: r2(economicsResult.index),
      housingEconomicsScore: r2(housingEconomicsScore),
      propertyAvailIndex: r2(propertyResult.index),
      propertyAvailScore: r2(propertyAvailScore),
      opportunityScore: total,
      priorityLevel: level,
      confidenceLevel: confidence,
      isEstimated: true,
      sourceGeography: `ZIP/ZCTA ${zipCode} demographics + ${data.geo.cocId ?? data.geo.city} regional Veteran homelessness/housing context`,
      sourceGeographyType: "zip",
      recommendation: recommendation(level),
      calculationVersion: VERSION,
      inputs: [...needResult.inputs, ...placementResult.inputs, ...economicsResult.inputs, ...propertyResult.inputs],
    };
  });

  return rows
    .sort((a, b) => b.opportunityScore - a.opportunityScore || a.zipCode.localeCompare(b.zipCode))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}
