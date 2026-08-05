/**
 * Census ACS collector.
 * Uses Census API v1 — CENSUS_KEY is optional (limited keyless requests allowed).
 */
import type { CollectorResult, CensusData, GeoContext } from "../types";

export interface CensusCollectorConfig {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  censusKey?: string;
}

// State FIPS to Census API state code
const CENSUS_PLACE_OVERRIDES: Record<string, { state: string; place: string }> = {
  "atlanta,ga": { state: "13", place: "04000" },
  "los angeles,ca": { state: "06", place: "44000" },
  "new york,ny": { state: "36", place: "51000" },
  "houston,tx": { state: "48", place: "35000" },
  "phoenix,az": { state: "04", place: "55000" },
  "dallas,tx": { state: "48", place: "19000" },
  "chicago,il": { state: "17", place: "14000" },
  "seattle,wa": { state: "53", place: "63000" },
  "denver,co": { state: "08", place: "20000" },
  "charlotte,nc": { state: "37", place: "12000" },
};

export async function collectCensusAcs(
  geo: GeoContext,
  config: CensusCollectorConfig = {}
): Promise<CollectorResult<CensusData>> {
  const { fetchFn = fetch, timeoutMs = 10000, censusKey } = config;
  const now = new Date().toISOString();
  const acsVintage = "ACS 2022 5-year";

  const placeKey = `${geo.city.toLowerCase()},${geo.stateAbbr.toLowerCase()}`;
  const override = CENSUS_PLACE_OVERRIDES[placeKey];

  if (!override) {
    return {
      data: null,
      status: "not_verified",
      source: makeSource(now, acsVintage, geo),
      error: `Census place code not known for ${geo.city}, ${geo.stateAbbr}`,
    };
  }

  const vars = ["B01003_001E", "B02001_003E", "B19013_001E", "B17001_002E", "B17001_001E"];
  const keyParam = censusKey ? `&key=${censusKey}` : "";
  const url = `https://api.census.gov/data/2022/acs/acs5?get=${vars.join(",")}&for=place:${override.place}&in=state:${override.state}${keyParam}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchFn(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        return { data: null, status: "not_verified", source: makeSource(now, acsVintage, geo), error: `Census API error: HTTP ${res.status}` };
      }
      const json = await res.json() as unknown;
      const parsed = parseCensusResponse(json);
      if (!parsed) {
        return { data: null, status: "not_verified", source: makeSource(now, acsVintage, geo), error: "Census response parse failed" };
      }
      return {
        data: { ...parsed, acsVintage },
        status: "ok",
        source: { ...makeSource(now, acsVintage, geo), confidence: "high" },
      };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    return { data: null, status: "not_verified", source: makeSource(now, acsVintage, geo), error: msg };
  }
}

function parseCensusResponse(json: unknown): Omit<CensusData, "acsVintage"> | null {
  if (!Array.isArray(json) || json.length < 2) return null;
  const headers = json[0] as string[];
  const row = json[1] as (string | null)[];
  const get = (name: string): number | null => {
    const idx = headers.indexOf(name);
    if (idx < 0) return null;
    const val = Number(row[idx]);
    return isNaN(val) || val < 0 ? null : val;
  };
  const total = get("B01003_001E");
  const blackPop = get("B02001_003E");
  const medianIncome = get("B19013_001E");
  const povertyCount = get("B17001_002E");
  const povertyUniverse = get("B17001_001E");
  return {
    totalPopulation: total,
    blackPopulationPct: total && blackPop ? blackPop / total : null,
    medianHouseholdIncome: medianIncome,
    povertyRatePct: povertyCount && povertyUniverse ? povertyCount / povertyUniverse : null,
  };
}

function makeSource(retrievedAt: string, acsVintage: string, geo: GeoContext) {
  return {
    sourceKey: "census_acs",
    sourceAgency: "U.S. Census Bureau",
    datasetName: `American Community Survey 5-Year Estimates (${acsVintage})`,
    directUrl: "https://api.census.gov/data/",
    reportingPeriod: acsVintage,
    geography: `City of ${geo.city}, ${geo.stateAbbr}`,
    retrievedAt,
    retrievalMethod: "api" as const,
    confidence: "not_verified" as const,
    isDerived: false,
  };
}
