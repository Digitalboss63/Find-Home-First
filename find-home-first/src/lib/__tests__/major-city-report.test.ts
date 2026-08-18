import { beforeEach, describe, expect, it, vi } from "vitest";

import { collectCensusAcs, _clearCensusPlaceCacheForTesting } from "../market-intelligence/collectors/census";
import { collectHudPit } from "../market-intelligence/collectors/hud-pit";
import { collectVaPrograms } from "../market-intelligence/collectors/va-programs";
import { resolveGeography } from "../market-intelligence/geo-resolver";
import { scoreMarket } from "../market-intelligence/scoring";
import type {
  ChasData,
  CollectedData,
  CollectorResult,
  GeoContext,
  IncomeLimitsData,
  RentCastMarketData,
  SourceRecord,
} from "../market-intelligence/types";

const source = (sourceKey: string): SourceRecord => ({
  sourceKey,
  sourceAgency: "Test agency",
  datasetName: "Test dataset",
  directUrl: null,
  reportingPeriod: "2025",
  geography: "Test geography",
  retrievedAt: "2026-08-18T00:00:00.000Z",
  retrievalMethod: "static",
  confidence: "high",
  isDerived: false,
});

const result = <T>(sourceKey: string, data: T | null): CollectorResult<T> => ({
  data,
  status: data === null ? "not_verified" : "ok",
  source: source(sourceKey),
});

function collectedWithHousingEvidence(options: { povertyRatePct?: number | null; includePit?: boolean } = {}): CollectedData {
  const geo = resolveGeography("Milwaukee, WI");
  return {
    geo,
    pit: result("hud_pit", options.includePit ? {
      totalHomeless: 1000,
      unsheltered: 300,
      adultsWithoutChildren: 800,
      veterans: 100,
      chronicHomeless: 250,
      blackHomeless: null,
      blackPct: null,
      reportingYear: 2025,
      veterans2026Estimate: null,
    } : null),
    census: result("census_acs", options.povertyRatePct === undefined ? null : {
      totalPopulation: 560000,
      blackPopulationPct: 0.38,
      medianHouseholdIncome: 52000,
      povertyRatePct: options.povertyRatePct,
      acsVintage: "ACS 2024 5-year",
    }),
    fmr: result("hud_fmr", {
      studio: 900,
      oneBr: 1050,
      twoBr: 1300,
      threeBr: 1650,
      fourBr: 1900,
      fmrYear: "FY2026",
      fmrArea: "Milwaukee-Waukesha, WI MSA",
    }),
    rentcast: result<RentCastMarketData>("rentcast", null),
    vaPrograms: result("va_programs", {
      programs: [{
        programName: "HUD-VASH",
        fitRank: "Best Immediate",
        localAdminOrg: "Local VA Medical Center",
        sharedHousingCompatibility: "Not Verified — confirm locally",
        referralProcess: "Contact local HUD-VASH coordinator",
        currentAvailability: "Not Verified",
        unresolvedRestrictions: "Local rules",
        sourceKey: "va_hud_vash",
        reportingDate: "2026-08",
      }],
    }),
    incomeLimits: result<IncomeLimitsData>("hud_income_limits", null),
    chas: result<ChasData>("hud_chas", null),
    collectedAt: "2026-08-18T00:00:00.000Z",
  };
}

describe("Philadelphia major-city coverage", () => {
  it("resolves Philadelphia to the correct CoC and local housing agencies", () => {
    const geo = resolveGeography("Philadelphia, PA");
    expect(geo.stateFips).toBe("42");
    expect(geo.county).toBe("Philadelphia County");
    expect(geo.cocId).toBe("PA-500");
    expect(geo.phaName).toBe("Philadelphia Housing Authority");
  });

  it("returns official 2025 PA-500 PIT figures without a network call", async () => {
    const fetchFn = vi.fn();
    const pit = await collectHudPit(resolveGeography("Philadelphia, PA"), {
      fetchFn: fetchFn as unknown as typeof fetch,
      hudToken: "unused-test-token",
    });

    expect(fetchFn).not.toHaveBeenCalled();
    expect(pit.status).toBe("ok");
    expect(pit.data).toMatchObject({
      totalHomeless: 5516,
      unsheltered: 1178,
      adultsWithoutChildren: 4219,
      veterans: 284,
      chronicHomeless: 1612,
      reportingYear: 2025,
    });
    expect(pit.source.directUrl).toContain("CoC_PopSub_CoC_PA-500-2025");
    expect(JSON.stringify(pit)).not.toContain("unused-test-token");
  });

  it("includes Philadelphia-specific VA and CoC program contacts", () => {
    const programs = collectVaPrograms(resolveGeography("Philadelphia, PA"));
    const serialized = JSON.stringify(programs.data);
    expect(serialized).toContain("Corporal Michael J. Crescenz VA Medical Center");
    expect(serialized).toContain("City of Philadelphia Office of Homeless Services");
  });

  it("uses Philadelphia's ACS place code and current 2024 five-year vintage", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        ["B01003_001E", "B02001_003E", "B19013_001E", "B17001_002E", "B17001_001E", "state", "place"],
        ["1550000", "620000", "60000", "330000", "1500000", "42", "60000"],
      ],
    });

    const census = await collectCensusAcs(resolveGeography("Philadelphia, PA"), {
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    expect(census.status).toBe("ok");
    expect(census.data?.acsVintage).toBe("ACS 2024 5-year");
    expect(String(fetchFn.mock.calls[0]?.[0])).toContain("place:60000");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe("nationwide Census fallback", () => {
  beforeEach(() => _clearCensusPlaceCacheForTesting());

  it("dynamically resolves a Census place code for a city outside the static lookup", async () => {
    const geo: GeoContext = resolveGeography("Milwaukee, WI");
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          ["NAME", "state", "place"],
          ["Milwaukee city, Wisconsin", "55", "53000"],
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          ["B01003_001E", "B02001_003E", "B19013_001E", "B17001_002E", "B17001_001E", "state", "place"],
          ["560000", "210000", "52000", "115000", "545000", "55", "53000"],
        ],
      });

    const census = await collectCensusAcs(geo, { fetchFn: fetchFn as unknown as typeof fetch });
    expect(census.status).toBe("ok");
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(String(fetchFn.mock.calls[0]?.[0])).toContain("for=place:*");
    expect(String(fetchFn.mock.calls[1]?.[0])).toContain("place:53000");
  });
});

describe("honest fallback scoring", () => {
  it("uses ACS poverty evidence instead of automatically returning Insufficient Evidence", () => {
    const scored = scoreMarket(collectedWithHousingEvidence({ povertyRatePct: 0.22 }));
    expect(scored.verdict).not.toBe("Insufficient Evidence");
    expect(scored.confidence).toBe("low");
    expect(scored.scorecard[0].numericScore).toBe(65);
    expect(scored.scorecard[0].reason).toContain("ACS poverty rate 22.0%");
    expect(scored.scorecard[0].missingEvidence).toContain("PIT count");
  });

  it("still refuses to invent a verdict when PIT, Census, and CHAS evidence are all absent", () => {
    const scored = scoreMarket(collectedWithHousingEvidence());
    expect(scored.verdict).toBe("Insufficient Evidence");
    expect(scored.overallScore).toBeNull();
    expect(scored.verdictExplanation).toContain("will not guess");
  });
});
