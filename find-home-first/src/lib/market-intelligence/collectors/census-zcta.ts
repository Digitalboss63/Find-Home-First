import type { CollectorResult, GeoContext, ZipDemographicData } from "../types";

export async function collectCensusZcta(
  geo: GeoContext,
  zipCodes: string[],
  config: { fetchFn?: typeof fetch; apiKey?: string; timeoutMs?: number } = {}
): Promise<CollectorResult<ZipDemographicData[]>> {
  const { fetchFn = fetch, apiKey = process.env.CENSUS_API_KEY, timeoutMs = 15000 } = config;
  const now = new Date().toISOString();
  const uniqueZips = [...new Set(zipCodes.filter((z) => /^\d{5}$/.test(z)))].slice(0, 40);
  const source = {
    sourceKey: "census_acs_zcta",
    sourceAgency: "U.S. Census Bureau",
    datasetName: "2024 ACS 5-Year Subject Tables — Veteran Status and Poverty",
    directUrl: "https://api.census.gov/data/2024/acs/acs5/subject",
    reportingPeriod: "2024 ACS 5-year",
    geography: `${geo.city}, ${geo.stateAbbr} ZIP/ZCTA candidates`,
    retrievedAt: now,
    retrievalMethod: "api" as const,
    confidence: (apiKey && uniqueZips.length ? "high" : "not_verified") as "high" | "not_verified",
    isDerived: false,
  };
  if (!apiKey) return { data: null, status: "not_verified", source, error: "CENSUS_API_KEY not configured" };
  if (!uniqueZips.length) return { data: [], status: "partial", source: { ...source, confidence: "medium" }, error: "No ZIP candidates were returned by the property source" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const rows = await Promise.all(uniqueZips.map(async (zip): Promise<ZipDemographicData | null> => {
      const get = "NAME,S2101_C01_001E,S2101_C03_001E,S2101_C04_001E,S1701_C03_001E";
      const url = `https://api.census.gov/data/2024/acs/acs5/subject?get=${get}&for=zip%20code%20tabulation%20area:${zip}&key=${encodeURIComponent(apiKey)}`;
      const res = await fetchFn(url, { signal: controller.signal });
      if (!res.ok) return null;
      const json = await res.json() as unknown;
      if (!Array.isArray(json) || json.length < 2 || !Array.isArray(json[0]) || !Array.isArray(json[1])) return null;
      const header = json[0] as string[];
      const values = json[1] as string[];
      const value = (name: string) => values[header.indexOf(name)];
      const num = (name: string) => {
        const n = Number(value(name));
        return Number.isFinite(n) && n >= 0 ? n : null;
      };
      return {
        zipCode: zip,
        civilianPopulation18Plus: num("S2101_C01_001E"),
        veteranPopulation: num("S2101_C03_001E"),
        veteranPct: num("S2101_C04_001E"),
        povertyRatePct: num("S1701_C03_001E"),
        acsVintage: "2024 ACS 5-year",
      };
    }));
    const data = rows.filter((r): r is ZipDemographicData => r !== null);
    return { data, status: data.length === uniqueZips.length ? "ok" : "partial", source: { ...source, confidence: data.length ? "high" : "not_verified" }, ...(data.length ? {} : { error: "No ZCTA demographic rows returned" }) };
  } catch (err) {
    return { data: null, status: "not_verified", source: { ...source, confidence: "not_verified" }, error: err instanceof Error ? err.message : "Census ZCTA collection failed" };
  } finally {
    clearTimeout(timer);
  }
}
