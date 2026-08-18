/**
 * HUD Point-in-Time (PIT) count collector.
 *
 * Uses published HUD Exchange CoC reports. HUD User does not expose a PIT
 * endpoint, so this collector must never spend a request on a fabricated API
 * route. Recognized CoCs are backed by their official published report URL.
 */
import type { CollectorResult, PitData, GeoContext } from "../types";

export interface HudPitCollectorConfig {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  hudToken?: string;
}

interface PublishedPitData extends Partial<PitData> {
  sourceUrl: string;
}

// Published HUD CoC reports used when no machine-readable PIT endpoint exists.
// These are authoritative source-backed fallbacks, not demo fixtures.
const KNOWN_PIT: Record<string, PublishedPitData> = {
  "GA-500": {
    totalHomeless: 2867,
    unsheltered: 1040,
    adultsWithoutChildren: 2527,
    veterans: 277, // 2024 official count; 2026 estimate ~241 (down 13%)
    chronicHomeless: 837,
    blackHomeless: 2358,
    blackPct: 0.822,
    reportingYear: 2024,
    veterans2026Estimate: 241,
    sourceUrl: "https://files.hudexchange.info/reports/published/CoC_PopSub_CoC_GA-500-2024_GA_2024.pdf",
  },
  "PA-500": {
    totalHomeless: 5516,
    unsheltered: 1178,
    adultsWithoutChildren: 4219,
    veterans: 284,
    chronicHomeless: 1612,
    blackHomeless: 3478,
    blackPct: 3478 / 5516,
    reportingYear: 2025,
    veterans2026Estimate: null,
    sourceUrl: "https://files.hudexchange.info/reports/published/CoC_PopSub_CoC_PA-500-2025_PA_2025.pdf",
  },
};

function notVerified(geo: GeoContext, error?: string): CollectorResult<PitData> {
  return {
    data: null,
    status: "not_verified",
    source: {
      sourceKey: "hud_pit",
      sourceAgency: "U.S. Department of Housing and Urban Development",
      datasetName: "Point-in-Time Count",
      directUrl: "https://www.hudexchange.info/resource/3031/pit-and-hic-data-since-2007/",
      reportingPeriod: "Not available",
      geography: geo.cocId ? `${geo.cocId} ${geo.cocName ?? ""}`.trim() : geo.city,
      retrievedAt: new Date().toISOString(),
      retrievalMethod: "api",
      confidence: "not_verified",
      isDerived: false,
    },
    error,
  };
}

export async function collectHudPit(
  geo: GeoContext,
  config: HudPitCollectorConfig = {}
): Promise<CollectorResult<PitData>> {
  // Keep the config parameter for API compatibility with the job runner. PIT
  // data itself comes from published CoC reports, not the HUD User API.
  void config;
  const now = new Date().toISOString();

  if (!geo.cocId) {
    return notVerified(geo, "CoC ID not known for this geography");
  }

  // Use source-backed published data for recognized CoCs.
  const known = KNOWN_PIT[geo.cocId];
  if (known) {
    const data: PitData = {
      totalHomeless: known.totalHomeless ?? null,
      unsheltered: known.unsheltered ?? null,
      adultsWithoutChildren: known.adultsWithoutChildren ?? null,
      veterans: known.veterans ?? null,
      chronicHomeless: known.chronicHomeless ?? null,
      blackHomeless: known.blackHomeless ?? null,
      blackPct: known.blackPct ?? null,
      reportingYear: known.reportingYear ?? 2024,
      veterans2026Estimate: known.veterans2026Estimate ?? null,
    };
    return {
      data,
      status: "ok",
      source: {
        sourceKey: "hud_pit",
        sourceAgency: "U.S. Department of Housing and Urban Development",
        datasetName: "Point-in-Time Count and Housing Inventory Count",
        directUrl: known.sourceUrl,
        reportingPeriod: `${data.reportingYear} PIT`,
        geography: `${geo.cocId} ${geo.cocName ?? ""}`.trim(),
        retrievedAt: now,
        retrievalMethod: "static",
        confidence: "high",
        isDerived: false,
      },
    };
  }

  return notVerified(geo, `No PIT data available for CoC ${geo.cocId}`);
}
