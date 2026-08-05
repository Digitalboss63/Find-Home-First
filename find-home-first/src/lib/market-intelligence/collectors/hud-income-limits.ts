/**
 * HUD Income Limits (IL) collector.
 *
 * Uses the same entity ID resolution as the FMR collector.
 * Requires HUD_TOKEN (Authorization: Bearer header).
 * Returns not_verified when token absent or API fails.
 *
 * HUD_TOKEN is server-side only. Never logged or returned.
 */
import type { CollectorResult, IncomeLimitsData, GeoContext } from "../types";

const HUD_API_BASE = "https://www.huduser.gov/hudapi/public";

export interface HudIncomeLimitsConfig {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  hudToken?: string;
  /** Pre-resolved entity ID (e.g. from FMR entity resolution) */
  entityId?: string;
}

function parseIlResponse(json: unknown, geo: GeoContext): IncomeLimitsData | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;
  const data = obj["data"] && typeof obj["data"] === "object" ? obj["data"] as Record<string, unknown> : null;
  if (!data) return null;

  const medianIncome = data["median_income"] != null ? Number(data["median_income"]) : null;
  const il50_p1 = data["il50_p1"] != null ? Number(data["il50_p1"]) : null;
  const il80_p1 = data["il80_p1"] != null ? Number(data["il80_p1"]) : null;
  const year = String(data["year"] ?? new Date().getFullYear());
  const areaName = String(data["area_name"] ?? data["metro_name"] ?? data["county_name"] ?? geo.city);

  if (medianIncome === null && il50_p1 === null) return null;

  return { medianIncome, il50_p1, il80_p1, areaName, reportingYear: year };
}

export async function collectHudIncomeLimits(
  geo: GeoContext,
  config: HudIncomeLimitsConfig = {}
): Promise<CollectorResult<IncomeLimitsData>> {
  const {
    fetchFn = fetch,
    timeoutMs = 10000,
    hudToken = process.env.HUD_TOKEN,
    entityId,
  } = config;
  const now = new Date().toISOString();

  const makeSource = (confidence: "high" | "medium" | "not_verified") => ({
    sourceKey: "hud_income_limits",
    sourceAgency: "U.S. Department of Housing and Urban Development",
    datasetName: "HUD Income Limits",
    directUrl: "https://www.huduser.gov/portal/datasets/il.html",
    reportingPeriod: `${new Date().getFullYear()}`,
    geography: geo.fmrArea ?? geo.city,
    retrievedAt: now,
    retrievalMethod: "api" as const,
    confidence,
    isDerived: false,
  });

  if (!hudToken) {
    return { data: null, status: "not_verified", source: makeSource("not_verified"), error: "HUD_TOKEN not configured" };
  }

  if (!entityId) {
    return { data: null, status: "not_verified", source: makeSource("not_verified"), error: "Entity ID not provided" };
  }

  const currentYear = new Date().getFullYear();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(`${HUD_API_BASE}/il/data/${encodeURIComponent(entityId)}?year=${currentYear}`, {
      headers: { Authorization: `Bearer ${hudToken}` },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { data: null, status: "not_verified", source: makeSource("not_verified"), error: `HUD Income Limits API error: HTTP ${res.status}` };
    }
    const json = await res.json() as unknown;
    const data = parseIlResponse(json, geo);
    if (!data) {
      return { data: null, status: "not_verified", source: makeSource("not_verified"), error: "Income Limits response parse failed" };
    }
    return {
      data,
      status: "ok",
      source: {
        ...makeSource("high"),
        reportingPeriod: data.reportingYear,
        geography: data.areaName,
        directUrl: `${HUD_API_BASE}/il/data/${encodeURIComponent(entityId)}?year=${currentYear}`,
      },
    };
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : "Network error";
    return { data: null, status: "not_verified", source: makeSource("not_verified"), error: msg };
  }
}
