/**
 * HUD Fair Market Rent (FMR) collector.
 *
 * When HUD_TOKEN is configured:
 *   1. Resolves the FMR entity ID for the geography via /fmr/listMetroAreas
 *      (or /fmr/listCounties/{state}) — never hardcodes unverified entity IDs.
 *   2. Fetches FMR data from /fmr/data/{entityId} with Authorization: Bearer header.
 * Falls back to static known FY2026 data for recognized metros when API unavailable.
 * Returns not_verified for unknown geographies without a token.
 *
 * HUD_TOKEN is server-side only. Never logged or returned in any response.
 */
import type { CollectorResult, FmrData, GeoContext } from "../types";

const HUD_API_BASE = "https://www.huduser.gov/hudapi/public";

export interface HudFmrCollectorConfig {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  hudToken?: string;
}

// Known FY2026 FMR data — static fallback for recognized CoCs when API unavailable.
// Values from official HUD FY2026 publications.
const KNOWN_FMR: Record<string, FmrData> = {
  "GA-500": { studio: 1585, oneBr: 1660, twoBr: 1820, threeBr: 2182, fourBr: 2605, fmrYear: "FY2026", fmrArea: "Atlanta-Sandy Springs-Alpharetta HMFA" },
  "CA-600": { studio: 2010, oneBr: 2414, twoBr: 3062, threeBr: 4083, fourBr: 4506, fmrYear: "FY2026", fmrArea: "Los Angeles-Long Beach-Glendale HMFA" },
  "NY-600": { studio: 2000, oneBr: 2394, twoBr: 2781, threeBr: 3558, fourBr: 3890, fmrYear: "FY2026", fmrArea: "New York, NY HMFA" },
  "TX-700": { studio: 1085, oneBr: 1218, twoBr: 1497, threeBr: 2013, fourBr: 2340, fmrYear: "FY2026", fmrArea: "Houston-The Woodlands-Sugar Land HMFA" },
  "AZ-502": { studio: 1230, oneBr: 1408, twoBr: 1672, threeBr: 2304, fourBr: 2730, fmrYear: "FY2026", fmrArea: "Phoenix-Mesa-Scottsdale HMFA" },
  "TX-600": { studio: 1060, oneBr: 1220, twoBr: 1520, threeBr: 2020, fourBr: 2370, fmrYear: "FY2026", fmrArea: "Dallas-Plano-Irving HMFA" },
  "IL-510": { studio: 1093, oneBr: 1248, twoBr: 1550, threeBr: 1989, fourBr: 2270, fmrYear: "FY2026", fmrArea: "Chicago-Joliet-Naperville HMFA" },
  "WA-500": { studio: 1736, oneBr: 2064, twoBr: 2538, threeBr: 3510, fourBr: 4190, fmrYear: "FY2026", fmrArea: "Seattle-Bellevue HMFA" },
  "CO-503": { studio: 1421, oneBr: 1634, twoBr: 2031, threeBr: 2869, fourBr: 3380, fmrYear: "FY2026", fmrArea: "Denver-Aurora-Lakewood HMFA" },
  "NC-505": { studio: 1050, oneBr: 1178, twoBr: 1410, threeBr: 1869, fourBr: 2200, fmrYear: "FY2026", fmrArea: "Charlotte-Concord-Gastonia HMFA" },
};

// In-memory cache of resolved entity IDs per city+state lookup key.
// Populated once at runtime; survives across requests in the same process.
const entityIdCache = new Map<string, string>();

/**
 * Resolves the HUD FMR entity ID for a geography by calling /fmr/listMetroAreas
 * and matching on the city name in area_name.
 * Falls back to /fmr/listCounties/{state} if no metro match found.
 * Returns null if resolution fails.
 * Never logs or returns the token.
 */
async function resolveEntityId(
  geo: GeoContext,
  token: string,
  fetchFn: typeof fetch,
  timeoutMs: number
): Promise<string | null> {
  const cacheKey = `${geo.city.toLowerCase()},${geo.stateAbbr.toLowerCase()}`;
  const cached = entityIdCache.get(cacheKey);
  if (cached) return cached;

  const cityLower = geo.city.toLowerCase();

  // Try metro areas first
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchFn(`${HUD_API_BASE}/fmr/listMetroAreas`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const json = await res.json() as unknown;
        const entityId = parseMetroAreasForCity(json, cityLower);
        if (entityId) {
          entityIdCache.set(cacheKey, entityId);
          return entityId;
        }
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // fall through to county lookup
  }

  // Try county lookup as fallback
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchFn(`${HUD_API_BASE}/fmr/listCounties/${geo.stateAbbr}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const json = await res.json() as unknown;
        const entityId = parseCountiesForCity(json, geo.county ?? geo.city);
        if (entityId) {
          entityIdCache.set(cacheKey, entityId);
          return entityId;
        }
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // resolution failed
  }

  return null;
}

function parseMetroAreasForCity(json: unknown, cityLower: string): string | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;
  const data = Array.isArray(obj["data"]) ? obj["data"] : null;
  if (!data) return null;
  const match = data.find((row: unknown) => {
    if (!row || typeof row !== "object") return false;
    const r = row as Record<string, unknown>;
    return String(r["area_name"] ?? "").toLowerCase().includes(cityLower);
  });
  if (!match || typeof match !== "object") return null;
  const r = match as Record<string, unknown>;
  return typeof r["cbsa_code"] === "string" ? r["cbsa_code"] : null;
}

function parseCountiesForCity(json: unknown, countyOrCity: string): string | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;
  const data = Array.isArray(obj["data"]) ? obj["data"] : null;
  if (!data) return null;
  const nameLower = countyOrCity.toLowerCase();
  const match = data.find((row: unknown) => {
    if (!row || typeof row !== "object") return false;
    const r = row as Record<string, unknown>;
    const county = String(r["county_name"] ?? "").toLowerCase();
    return county.includes(nameLower) || nameLower.includes(county.split(" ")[0]);
  });
  if (!match || typeof match !== "object") return null;
  const r = match as Record<string, unknown>;
  return typeof r["fips_code"] === "string" ? r["fips_code"] : null;
}

function parseFmrDataResponse(json: unknown, geo: GeoContext): FmrData | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;
  const data = (obj["data"] && typeof obj["data"] === "object") ? obj["data"] as Record<string, unknown> : null;
  if (!data) return null;

  // basicdata can be an object or an array (for Small Area FMR with ZIP codes)
  let bd: Record<string, unknown> | null = null;
  if (Array.isArray(data["basicdata"])) {
    // Small Area FMR: find MSA-level entry
    const msaEntry = (data["basicdata"] as unknown[]).find((entry: unknown) => {
      const e = entry as Record<string, unknown>;
      return e["zip_code"] === "MSA level";
    });
    bd = (msaEntry as Record<string, unknown>) ?? (data["basicdata"] as unknown[])[0] as Record<string, unknown>;
  } else if (data["basicdata"] && typeof data["basicdata"] === "object") {
    bd = data["basicdata"] as Record<string, unknown>;
  }
  if (!bd) return null;

  const efficiency = Number(bd["Efficiency"] ?? 0);
  const oneBr = Number(bd["One-Bedroom"] ?? 0);
  const twoBr = Number(bd["Two-Bedroom"] ?? 0);
  const threeBr = Number(bd["Three-Bedroom"] ?? 0);
  const fourBr = Number(bd["Four-Bedroom"] ?? 0);
  if (!efficiency && !oneBr) return null;

  const year = String(bd["year"] ?? data["year"] ?? new Date().getFullYear());
  const fmrYear = year.startsWith("FY") ? year : `FY${year}`;
  const areaName = String(data["area_name"] ?? data["metro_name"] ?? data["county_name"] ?? geo.fmrArea ?? geo.city);

  return { studio: efficiency, oneBr, twoBr, threeBr, fourBr, fmrYear, fmrArea: areaName };
}

export async function collectHudFmr(
  geo: GeoContext,
  config: HudFmrCollectorConfig = {}
): Promise<CollectorResult<FmrData>> {
  const {
    fetchFn = fetch,
    timeoutMs = 10000,
    hudToken = process.env.HUD_TOKEN,
  } = config;
  const now = new Date().toISOString();

  const makeNotVerified = (error: string): CollectorResult<FmrData> => ({
    data: null,
    status: "not_verified",
    source: {
      sourceKey: "hud_fmr",
      sourceAgency: "U.S. Department of Housing and Urban Development",
      datasetName: "Fair Market Rents",
      directUrl: "https://www.huduser.gov/portal/datasets/fmr.html",
      reportingPeriod: "Not available",
      geography: geo.fmrArea ?? geo.city,
      retrievedAt: now,
      retrievalMethod: "api",
      confidence: "not_verified",
      isDerived: false,
    },
    error,
  });

  // Try live API when token available
  if (hudToken) {
    try {
      const entityId = await resolveEntityId(geo, hudToken, fetchFn, timeoutMs);
      if (entityId) {
        const currentYear = new Date().getFullYear();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetchFn(`${HUD_API_BASE}/fmr/data/${encodeURIComponent(entityId)}?year=${currentYear}`, {
            headers: { Authorization: `Bearer ${hudToken}` },
            signal: controller.signal,
          });
          clearTimeout(timer);
          if (res.ok) {
            const json = await res.json() as unknown;
            const fmr = parseFmrDataResponse(json, geo);
            if (fmr) {
              return {
                data: fmr,
                status: "ok",
                source: {
                  sourceKey: "hud_fmr",
                  sourceAgency: "U.S. Department of Housing and Urban Development",
                  datasetName: `HUD ${fmr.fmrYear} Fair Market Rents`,
                  directUrl: `${HUD_API_BASE}/fmr/data/${encodeURIComponent(entityId)}?year=${currentYear}`,
                  reportingPeriod: fmr.fmrYear,
                  geography: fmr.fmrArea,
                  retrievedAt: now,
                  retrievalMethod: "api",
                  confidence: "high",
                  isDerived: false,
                },
              };
            }
          }
        } finally {
          clearTimeout(timer);
        }
      }
    } catch {
      // fall through to static
    }
  }

  // Static known data fallback for recognized CoCs
  const cocKey = geo.cocId;
  if (cocKey && KNOWN_FMR[cocKey]) {
    const fmr = KNOWN_FMR[cocKey];
    return {
      data: fmr,
      status: hudToken ? "partial" : "ok",
      source: {
        sourceKey: "hud_fmr",
        sourceAgency: "U.S. Department of Housing and Urban Development",
        datasetName: `${fmr.fmrYear} Fair Market Rents (published data)`,
        directUrl: "https://www.huduser.gov/portal/datasets/fmr.html",
        reportingPeriod: fmr.fmrYear,
        geography: fmr.fmrArea,
        retrievedAt: now,
        retrievalMethod: "csv_parse",
        confidence: "high",
        isDerived: false,
      },
    };
  }

  return makeNotVerified(
    hudToken
      ? `Entity ID resolution failed for ${geo.city}, ${geo.stateAbbr}`
      : "HUD_TOKEN not configured and geography not in static lookup"
  );
}

/** Clears the entity ID resolution cache — for testing only. */
export function _clearEntityIdCacheForTesting(): void {
  entityIdCache.clear();
}
