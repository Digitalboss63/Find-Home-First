import "server-only";
import type { CollectedData, ZipDemographicData } from "@/lib/market-intelligence/types";
import type { ZipOpportunityRanking } from "@/lib/export/types";

const VERSION = "FHF-OPPORTUNITY-V1.1";
const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : 0));
const round2 = (n: number) => Math.round(n * 100) / 100;

function priority(score: number): ZipOpportunityRanking["priorityLevel"] {
  return score >= 80 ? "PRIORITY" : score >= 65 ? "STRONG" : score >= 50 ? "WATCH" : "LOW";
}

function placementIndex(data: CollectedData): number {
  const programs = data.vaPrograms.data?.programs ?? [];
  const fit = (prefix: string) => {
    const p = programs.find((x) => x.programName.startsWith(prefix));
    return p?.fitRank === "Best Immediate" ? 85 : p?.fitRank === "Possible" ? 65 : 50;
  };
  const va = data.geo.cocId ? 72 : data.geo.metro ? 62 : 50;
  return clamp(fit("SSVF") * .35 + fit("HUD-VASH") * .30 + va * .20 + 50 * .15);
}

function regionalPressure(data: CollectedData): number {
  const pit = data.pit.data;
  const pop = data.census.data?.totalPopulation;
  if (pit?.totalHomeless != null && pop && pop > 0) {
    const rate = pit.totalHomeless / pop * 10000;
    return rate >= 60 ? 95 : rate >= 40 ? 85 : rate >= 25 ? 72 : rate >= 15 ? 58 : rate >= 8 ? 45 : 32;
  }
  return 50;
}

function veteranNeedIndex(data: CollectedData, z: ZipDemographicData): number {
  const pressure = regionalPressure(data);
  const veteranPct = z.veteranPct ?? 0;
  const concentration = veteranPct >= 10 ? 90 : veteranPct >= 8 ? 80 : veteranPct >= 6 ? 70 : veteranPct >= 4 ? 58 : veteranPct > 0 ? 42 : 50;
  const poverty = z.povertyRatePct ?? 0;
  const vulnerability = poverty >= 25 ? 88 : poverty >= 18 ? 74 : poverty >= 12 ? 60 : poverty >= 8 ? 46 : poverty > 0 ? 32 : 50;
  let housingStress = 50;
  const chas = data.chas.data;
  if (chas?.totalOccupied && chas.renterCostBurdened30pct != null) {
    const share = chas.renterCostBurdened30pct / chas.totalOccupied;
    housingStress = share >= .40 ? 90 : share >= .30 ? 75 : share >= .20 ? 58 : 42;
  }
  return clamp(pressure * .40 + concentration * .30 + vulnerability * .20 + housingStress * .10);
}

function economicsIndex(data: CollectedData, medianRent: number | null): number {
  const fmr = data.fmr.data;
  if (!fmr || !medianRent || medianRent <= 0) return 50;
  // FMR is a screening benchmark only. It is NOT treated as per-room revenue.
  const ratio = fmr.fourBr / medianRent;
  return ratio >= 1.20 ? 95 : ratio >= 1.10 ? 85 : ratio >= 1.00 ? 72 : ratio >= .90 ? 58 : ratio >= .80 ? 42 : 25;
}

function propertyIndex(listings: NonNullable<CollectedData["rentcast"]["data"]>["sampleListings"], fmr4: number | null): number {
  if (!listings.length) return 35;
  const rents = listings.map((l) => l.rent).filter((v): v is number => typeof v === "number").sort((a, b) => a - b);
  const median = rents.length ? rents[Math.floor(rents.length / 2)] : null;
  const depth = listings.length >= 10 ? 90 : listings.length >= 6 ? 78 : listings.length >= 3 ? 65 : 52;
  const affordability = fmr4 && median ? (median <= fmr4 * .85 ? 90 : median <= fmr4 ? 75 : median <= fmr4 * 1.10 ? 55 : 30) : 50;
  const suitable = listings.filter((l) => (l.bedrooms ?? 0) >= 3).length / listings.length;
  const rooms = suitable >= .8 ? 90 : suitable >= .5 ? 72 : suitable > 0 ? 55 : 30;
  return clamp(depth * .40 + affordability * .35 + rooms * .25);
}

export function scoreZipOpportunities(data: CollectedData): ZipOpportunityRanking[] {
  const demographics = data.zipDemographics.data ?? [];
  const listings = data.rentcast.data?.sampleListings ?? [];
  const byZip = new Map<string, typeof listings>();
  for (const listing of listings) {
    if (!listing.zipCode) continue;
    const arr = byZip.get(listing.zipCode) ?? [];
    arr.push(listing);
    byZip.set(listing.zipCode, arr);
  }
  const candidates = demographics.filter((z) => byZip.has(z.zipCode));
  if (!candidates.length) return [];
  const pi = placementIndex(data);
  const fmr4 = data.fmr.data?.fourBr ?? null;

  const rows = candidates.map((z): ZipOpportunityRanking => {
    const zipListings = byZip.get(z.zipCode) ?? [];
    const rents = zipListings.map((l) => l.rent).filter((v): v is number => typeof v === "number").sort((a, b) => a - b);
    const medianRent = rents.length ? rents[Math.floor(rents.length / 2)] : null;
    const vn = veteranNeedIndex(data, z);
    const he = economicsIndex(data, medianRent);
    const pa = propertyIndex(zipListings, fmr4);
    const vnScore = vn * .40;
    const piScore = pi * .20;
    const heScore = he * .25;
    const paScore = pa * .15;
    const total = Math.round(clamp(vnScore + piScore + heScore + paScore));
    const level = priority(total);
    const estimated = data.pit.source.isDerived || data.chas.status !== "ok" || data.fmr.status !== "ok";
    const confidence: ZipOpportunityRanking["confidenceLevel"] = data.zipDemographics.status === "ok" && data.pit.status === "ok" && data.rentcast.status === "ok" ? (estimated ? "MEDIUM" : "HIGH") : "ESTIMATED";
    return {
      zipCode: z.zipCode,
      rank: 0,
      label: z.zipCode,
      veteranNeedIndex: round2(vn), veteranNeedScore: round2(vnScore),
      placementInfraIndex: round2(pi), placementInfraScore: round2(piScore),
      housingEconomicsIndex: round2(he), housingEconomicsScore: round2(heScore),
      propertyAvailIndex: round2(pa), propertyAvailScore: round2(paScore),
      opportunityScore: total,
      priorityLevel: level,
      confidenceLevel: confidence,
      isEstimated: estimated,
      sourceGeography: `${z.zipCode} ZCTA + ${data.geo.cocId ?? data.geo.city} regional homelessness context`,
      sourceGeographyType: "zip",
      recommendation: level === "PRIORITY" ? "Priority ZIP for property search." : level === "STRONG" ? "Strong ZIP; begin targeted property search and verify local payment standard." : level === "WATCH" ? "Watch ZIP; verify economics and referral capacity before committing." : "Lower priority with current evidence.",
      calculationVersion: VERSION,
    };
  });
  return rows.sort((a, b) => b.opportunityScore - a.opportunityScore || a.zipCode.localeCompare(b.zipCode)).map((r, i) => ({ ...r, rank: i + 1 }));
}
