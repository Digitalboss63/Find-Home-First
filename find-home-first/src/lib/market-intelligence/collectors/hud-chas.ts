/**
 * HUD CHAS (Comprehensive Housing Affordability Strategy) collector.
 *
 * Endpoint: GET /chas with params type, stateId, entityId, year
 * Resolves county entityId via /chas/listCounties/{stateId}.
 * Requires HUD_TOKEN (Authorization: Bearer header).
 * Returns not_verified when token absent or geography unknown.
 *
 * HUD_TOKEN is server-side only. Never logged or returned.
 */
import type { CollectorResult, ChasData, GeoContext } from "../types";

const HUD_API_BASE = "https://www.huduser.gov/hudapi/public";

// Georgia stateId = 13 per HUD CHAS documentation
const STATE_ID_MAP: Record<string, number> = {
  AL: 1, AK: 2, AZ: 4, AR: 5, CA: 6, CO: 8, CT: 9, DE: 10, FL: 12, GA: 13,
  HI: 15, ID: 16, IL: 17, IN: 18, IA: 19, KS: 20, KY: 21, LA: 22, ME: 23,
  MD: 24, MA: 25, MI: 26, MN: 27, MS: 28, MO: 29, MT: 30, NE: 31, NV: 32,
  NH: 33, NJ: 34, NM: 35, NY: 36, NC: 37, ND: 38, OH: 39, OK: 40, OR: 41,
  PA: 42, RI: 44, SC: 45, SD: 46, TN: 47, TX: 48, UT: 49, VT: 50, VA: 51,
  WA: 53, WV: 54, WI: 55, WY: 56, DC: 11,
};

// In-memory cache of resolved county entityIds for CHAS
const chasEntityCache = new Map<string, string>();

export interface HudChasConfig {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  hudToken?: string;
}

async function resolveCountyEntityId(
  geo: GeoContext,
  stateId: number,
  token: string,
  fetchFn: typeof fetch,
  timeoutMs: number
): Promise<string | null> {
  const cacheKey = `chas:${geo.stateAbbr}:${geo.county ?? geo.city}`;
  const cached = chasEntityCache.get(cacheKey);
  if (cached) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(`${HUD_API_BASE}/chas/listCounties/${stateId}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json() as unknown;
    if (!json || typeof json !== "object") return null;
    const obj = json as Record<string, unknown>;
    const data = Array.isArray(obj["data"]) ? obj["data"] : null;
    if (!data) return null;

    const targetName = (geo.county ?? geo.city).toLowerCase();
    const match = data.find((row: unknown) => {
      if (!row || typeof row !== "object") return false;
      const r = row as Record<string, unknown>;
      return String(r["county_name"] ?? "").toLowerCase().includes(targetName.split(" ")[0]);
    });
    if (!match || typeof match !== "object") return null;
    const r = match as Record<string, unknown>;
    const entityId = String(r["entity_id"] ?? r["entityId"] ?? r["fips_code"] ?? "");
    if (entityId) {
      chasEntityCache.set(cacheKey, entityId);
      return entityId;
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseChasResponse(json: unknown, geo: GeoContext, period: string): ChasData | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;
  const data = Array.isArray(obj["data"]) ? obj["data"][0] : (obj["data"] ?? null);
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;

  // A17 = Total Renter Occupied
  // A18 = Total Occupied
  // B2 = Renter with at least 1 housing problem
  // D8 = Renter cost burden >30% to <=50%
  // D9 = Renter cost burden >50% (severe)
  const totalOccupied = d["A18"] != null ? Number(d["A18"]) : null;
  const renterHousingProblems = d["B2"] != null ? Number(d["B2"]) : null;
  const renterCostBurdened30pct = d["D8"] != null ? Number(d["D8"]) : null;
  const renterCostBurdened50pct = d["D9"] != null ? Number(d["D9"]) : null;

  if (totalOccupied === null && renterHousingProblems === null) return null;

  return {
    totalOccupied,
    renterCostBurdened30pct,
    renterCostBurdened50pct,
    renterHousingProblems,
    reportingPeriod: period,
    geography: geo.county ? `${geo.county}, ${geo.stateAbbr}` : `${geo.city}, ${geo.stateAbbr}`,
  };
}

export async function collectHudChas(
  geo: GeoContext,
  config: HudChasConfig = {}
): Promise<CollectorResult<ChasData>> {
  const {
    fetchFn = fetch,
    timeoutMs = 10000,
    hudToken = process.env.HUD_TOKEN,
  } = config;
  const now = new Date().toISOString();
  const chasYear = "2014-2018"; // Latest available CHAS period

  const makeSource = (confidence: "high" | "medium" | "low" | "not_verified") => ({
    sourceKey: "hud_chas",
    sourceAgency: "U.S. Department of Housing and Urban Development",
    datasetName: "Comprehensive Housing Affordability Strategy (CHAS)",
    directUrl: "https://www.huduser.gov/portal/datasets/cp.html",
    reportingPeriod: chasYear,
    geography: geo.county ? `${geo.county}, ${geo.stateAbbr}` : `${geo.city}, ${geo.stateAbbr}`,
    retrievedAt: now,
    retrievalMethod: "api" as const,
    confidence,
    isDerived: false,
  });

  if (!hudToken) {
    return { data: null, status: "not_verified", source: makeSource("not_verified"), error: "HUD_TOKEN not configured" };
  }

  const stateId = STATE_ID_MAP[geo.stateAbbr];
  if (!stateId) {
    return { data: null, status: "not_verified", source: makeSource("not_verified"), error: `State ID not known for ${geo.stateAbbr}` };
  }

  // Try county-level (type=3) query
  try {
    const entityId = await resolveCountyEntityId(geo, stateId, hudToken, fetchFn, timeoutMs);
    if (entityId) {
      const url = `${HUD_API_BASE}/chas?type=3&stateId=${stateId}&entityId=${encodeURIComponent(entityId)}&year=${encodeURIComponent(chasYear)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetchFn(url, {
          headers: { Authorization: `Bearer ${hudToken}` },
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (res.ok) {
          const json = await res.json() as unknown;
          const data = parseChasResponse(json, geo, chasYear);
          if (data) {
            return { data, status: "ok", source: { ...makeSource("medium"), geography: data.geography } };
          }
        }
      } finally {
        clearTimeout(timer);
      }
    }
  } catch {
    // fall through to state-level
  }

  // Fall back to state-level (type=2)
  try {
    const url = `${HUD_API_BASE}/chas?type=2&stateId=${stateId}&year=${encodeURIComponent(chasYear)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchFn(url, {
        headers: { Authorization: `Bearer ${hudToken}` },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const json = await res.json() as unknown;
        const data = parseChasResponse(json, geo, chasYear);
        if (data) {
          const stateGeo = `${geo.stateAbbr} (state-level)`;
          return { data: { ...data, geography: stateGeo }, status: "partial", source: { ...makeSource("low"), geography: stateGeo } };
        }
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // failed
  }

  return { data: null, status: "not_verified", source: makeSource("not_verified"), error: "CHAS data collection failed" };
}

/** Clears the CHAS entity ID resolution cache — for testing only. */
export function _clearChasEntityCacheForTesting(): void {
  chasEntityCache.clear();
}
