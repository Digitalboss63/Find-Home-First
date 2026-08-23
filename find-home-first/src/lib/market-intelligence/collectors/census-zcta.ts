"server-only";

/**
 * Census ACS 5-year ZCTA collector for Property Opportunity Engine V1.
 *
 * Candidate ZIPs come from current RentCast inventory for the selected city.
 * We enrich those ZIPs with ACS Subject Table S2101 veteran data. This does
 * NOT claim ZIP-level homeless-Veteran counts; regional PIT pressure remains
 * a separate modeled input in the opportunity engine.
 */
import type { CollectorResult, GeoContext, ZipDemographicData } from "../types";

export interface CensusZctaCollectorConfig {
  fetchFn?: typeof fetch;
  apiKey?: string;
  timeoutMs?: number;
  concurrency?: number;
}

const ACS_VINTAGE = "2024 ACS 5-year";
const VARIABLES = [
  "NAME",
  "S2101_C01_001E", // civilian population 18+
  "S2101_C03_001E", // veterans 18+
  "S2101_C03_035E", // veterans for whom poverty status is determined
  "S2101_C03_036E", // veterans below poverty level
];

function makeSource(
  geo: GeoContext,
  retrievedAt: string,
  confidence: "high" | "medium" | "not_verified",
) {
  return {
    sourceKey: "census_acs_zcta",
    sourceAgency: "U.S. Census Bureau",
    datasetName: "2024 ACS 5-Year Subject Table S2101 — Veteran Status",
    directUrl: "https://api.census.gov/data/2024/acs/acs5/subject",
    reportingPeriod: ACS_VINTAGE,
    geography: `${geo.city}, ${geo.stateAbbr} candidate ZIP/ZCTAs`,
    retrievedAt,
    retrievalMethod: "api" as const,
    confidence,
    isDerived: false,
  };
}

function uniqueValidZips(zipCodes: string[]): string[] {
  return [...new Set(zipCodes.map((z) => z.trim()).filter((z) => /^\d{5}$/.test(z)))].sort();
}

function numberOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseZctaResponse(json: unknown, requestedZip: string): ZipDemographicData | null {
  if (!Array.isArray(json) || json.length < 2 || !Array.isArray(json[0]) || !Array.isArray(json[1])) return null;
  const headers = json[0] as string[];
  const row = json[1] as unknown[];
  const get = (name: string): number | null => {
    const idx = headers.indexOf(name);
    return idx >= 0 ? numberOrNull(row[idx]) : null;
  };

  const zipIdx = headers.indexOf("zip code tabulation area");
  const returnedZip = zipIdx >= 0 ? String(row[zipIdx] ?? "") : requestedZip;
  if (!/^\d{5}$/.test(returnedZip)) return null;

  const civilianPopulation18Plus = get("S2101_C01_001E");
  const veteranPopulation = get("S2101_C03_001E");
  const veteranPovertyUniverse = get("S2101_C03_035E");
  const veteransBelowPoverty = get("S2101_C03_036E");

  return {
    zipCode: returnedZip,
    civilianPopulation18Plus,
    veteranPopulation,
    veteranPct: civilianPopulation18Plus && veteranPopulation !== null
      ? veteranPopulation / civilianPopulation18Plus
      : null,
    povertyRatePct: veteranPovertyUniverse && veteransBelowPoverty !== null
      ? veteransBelowPoverty / veteranPovertyUniverse
      : null,
    acsVintage: ACS_VINTAGE,
  };
}

async function fetchZip(
  zipCode: string,
  fetchFn: typeof fetch,
  timeoutMs: number,
  apiKey: string,
): Promise<ZipDemographicData | null> {
  const keyParam = `&key=${encodeURIComponent(apiKey)}`;
  const url = `https://api.census.gov/data/2024/acs/acs5/subject?get=${VARIABLES.join(",")}&for=zip%20code%20tabulation%20area:${zipCode}${keyParam}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(url, { signal: controller.signal });
    if (!response.ok) return null;
    return parseZctaResponse(await response.json() as unknown, zipCode);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function collectCensusZcta(
  geo: GeoContext,
  zipCodes: string[],
  config: CensusZctaCollectorConfig = {},
): Promise<CollectorResult<ZipDemographicData[]>> {
  const {
    fetchFn = fetch,
    apiKey = process.env.CENSUS_API_KEY,
    timeoutMs = 10000,
    concurrency = 6,
  } = config;
  const now = new Date().toISOString();
  const zips = uniqueValidZips(zipCodes);

  if (!zips.length) {
    return {
      data: [],
      status: "not_verified",
      source: makeSource(geo, now, "not_verified"),
      error: "No candidate ZIP codes were available from current property inventory.",
    };
  }

  if (!apiKey) {
    return {
      data: [],
      status: "not_verified",
      source: makeSource(geo, now, "not_verified"),
      error: "CENSUS_API_KEY is not configured. ZIP-level ACS Veteran concentration and Veteran poverty inputs are unavailable, so ZIP Veteran Need uses neutral demographic fallback values.",
    };
  }

  const results: ZipDemographicData[] = [];
  const batchSize = Math.max(1, Math.min(10, concurrency));
  for (let i = 0; i < zips.length; i += batchSize) {
    const batch = zips.slice(i, i + batchSize);
    const rows = await Promise.all(batch.map((zip) => fetchZip(zip, fetchFn, timeoutMs, apiKey)));
    for (const row of rows) if (row) results.push(row);
  }

  if (!results.length) {
    return {
      data: [],
      status: "not_verified",
      source: makeSource(geo, now, "not_verified"),
      error: "Census ACS returned no usable ZCTA veteran records for candidate ZIPs.",
    };
  }

  const complete = results.length === zips.length;
  return {
    data: results,
    status: complete ? "ok" : "partial",
    source: makeSource(geo, now, complete ? "high" : "medium"),
    ...(complete ? {} : { error: `ACS ZCTA data resolved for ${results.length} of ${zips.length} candidate ZIPs.` }),
  };
}