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
    totalHomeless: 2894,
    unsheltered: 1061,
    adultsWithoutChildren: 2483,
    veterans: 278,
    chronicHomeless: 736,
    blackHomeless: 2437,
    blackPct: 2437 / 2894,
    reportingYear: 2025,
    veterans2026Estimate: null,
    sourceUrl: "https://files.hudexchange.info/reports/published/CoC_PopSub_CoC_GA-500-2025_GA_2025.pdf",
  },
  "CA-600": {
    totalHomeless: 67777,
    unsheltered: 44415,
    adultsWithoutChildren: 56516,
    veterans: 3050,
    chronicHomeless: 27561,
    blackHomeless: 18938,
    blackPct: 18938 / 67777,
    reportingYear: 2025,
    veterans2026Estimate: null,
    sourceUrl: "https://files.hudexchange.info/reports/published/CoC_PopSub_CoC_CA-600-2025_CA_2025.pdf",
  },
  "NY-600": {
    totalHomeless: 125683,
    unsheltered: 4673,
    adultsWithoutChildren: 49873,
    veterans: 697,
    chronicHomeless: 3605,
    blackHomeless: 50291,
    blackPct: 50291 / 125683,
    reportingYear: 2025,
    veterans2026Estimate: null,
    sourceUrl: "https://files.hudexchange.info/reports/published/CoC_PopSub_CoC_NY-600-2025_NY_2025.pdf",
  },
  "TX-700": {
    totalHomeless: 3325,
    unsheltered: 1282,
    adultsWithoutChildren: 2507,
    veterans: 195,
    chronicHomeless: 443,
    blackHomeless: 1862,
    blackPct: 1862 / 3325,
    reportingYear: 2025,
    veterans2026Estimate: null,
    sourceUrl: "https://files.hudexchange.info/reports/published/CoC_PopSub_CoC_TX-700-2025_TX_2025.pdf",
  },
  "AZ-502": {
    totalHomeless: 9734,
    unsheltered: 5207,
    adultsWithoutChildren: 7875,
    veterans: 469,
    chronicHomeless: 1930,
    blackHomeless: 2622,
    blackPct: 2622 / 9734,
    reportingYear: 2025,
    veterans2026Estimate: null,
    sourceUrl: "https://files.hudexchange.info/reports/published/CoC_PopSub_CoC_AZ-502-2025_AZ_2025.pdf",
  },
  "TX-600": {
    totalHomeless: 3541,
    unsheltered: 1037,
    adultsWithoutChildren: 2808,
    veterans: 286,
    chronicHomeless: 669,
    blackHomeless: 2009,
    blackPct: 2009 / 3541,
    reportingYear: 2025,
    veterans2026Estimate: null,
    sourceUrl: "https://files.hudexchange.info/reports/published/CoC_PopSub_CoC_TX-600-2025_TX_2025.pdf",
  },
  "IL-510": {
    totalHomeless: 7452,
    unsheltered: 1316,
    adultsWithoutChildren: 4043,
    veterans: 254,
    chronicHomeless: 1072,
    blackHomeless: 3967,
    blackPct: 3967 / 7452,
    reportingYear: 2025,
    veterans2026Estimate: null,
    sourceUrl: "https://files.hudexchange.info/reports/published/CoC_PopSub_CoC_IL-510-2025_IL_2025.pdf",
  },
  "WA-500": {
    totalHomeless: 16936,
    unsheltered: 9810,
    adultsWithoutChildren: 13247,
    veterans: 1019,
    chronicHomeless: 8664,
    blackHomeless: 3916,
    blackPct: 3916 / 16936,
    reportingYear: 2025,
    veterans2026Estimate: null,
    sourceUrl: "https://files.hudexchange.info/reports/published/CoC_PopSub_CoC_WA-500-2025_WA_2025.pdf",
  },
  "CO-503": {
    totalHomeless: 10774,
    unsheltered: 2149,
    adultsWithoutChildren: 7408,
    veterans: 623,
    chronicHomeless: 3709,
    blackHomeless: 1724,
    blackPct: 1724 / 10774,
    reportingYear: 2025,
    veterans2026Estimate: null,
    sourceUrl: "https://files.hudexchange.info/reports/published/CoC_PopSub_CoC_CO-503-2025_CO_2025.pdf",
  },
  "NC-505": {
    totalHomeless: 2117,
    unsheltered: 460,
    adultsWithoutChildren: 1622,
    veterans: 112,
    chronicHomeless: 581,
    blackHomeless: 1542,
    blackPct: 1542 / 2117,
    reportingYear: 2025,
    veterans2026Estimate: null,
    sourceUrl: "https://files.hudexchange.info/reports/published/CoC_PopSub_CoC_NC-505-2025_NC_2025.pdf",
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
