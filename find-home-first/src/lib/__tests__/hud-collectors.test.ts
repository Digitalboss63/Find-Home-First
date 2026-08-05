/**
 * HUD collector unit tests — deterministic mocked responses.
 * No live API calls. HUD_TOKEN never used or present.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { collectHudFmr, _clearEntityIdCacheForTesting } from "../market-intelligence/collectors/hud-fmr";
import { collectHudIncomeLimits } from "../market-intelligence/collectors/hud-income-limits";
import { collectHudChas, _clearChasEntityCacheForTesting } from "../market-intelligence/collectors/hud-chas";
import { testHudConnection } from "../market-intelligence/collectors/hud-connection-test";
import type { GeoContext } from "../market-intelligence/types";

const ATLANTA_GEO: GeoContext = {
  city: "Atlanta",
  stateAbbr: "GA",
  stateFips: "13",
  county: "Fulton County",
  metro: "Atlanta-Sandy Springs-Alpharetta, GA MSA",
  fmrArea: "Atlanta-Sandy Springs-Alpharetta HMFA",
  cocId: "GA-500",
  cocName: "Atlanta CoC (GA-500)",
  phaName: "Atlanta Housing",
};

const UNKNOWN_GEO: GeoContext = {
  city: "Smalltown",
  stateAbbr: "KS",
  stateFips: "20",
  county: null,
  metro: null,
  fmrArea: null,
  cocId: null,
  cocName: null,
  phaName: null,
};

// ─── FMR collector ────────────────────────────────────────────────────────────

describe("collectHudFmr — no token", () => {
  it("returns static known data for Atlanta without a token", async () => {
    const result = await collectHudFmr(ATLANTA_GEO, { hudToken: undefined });
    expect(result.status).toBe("ok");
    expect(result.data).not.toBeNull();
    expect(result.data!.fourBr).toBe(2605);
    expect(result.data!.fmrYear).toBe("FY2026");
    expect(result.data!.fmrArea).toContain("Atlanta");
    expect(result.source.sourceKey).toBe("hud_fmr");
    expect(result.source.confidence).toBe("high");
    expect(result.source.reportingPeriod).toContain("FY2026");
  });

  it("returns not_verified for unknown geography without a token", async () => {
    const result = await collectHudFmr(UNKNOWN_GEO, { hudToken: undefined });
    expect(result.status).toBe("not_verified");
    expect(result.data).toBeNull();
  });
});

describe("collectHudFmr — with mocked token and entity resolution", () => {
  beforeEach(() => {
    _clearEntityIdCacheForTesting();
    _clearChasEntityCacheForTesting();
  });

  it("uses live API when token present and entity resolved", async () => {
    // Mock: listMetroAreas returns Atlanta entry
    const mockListMetros = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ cbsa_code: "METRO12060M12060", area_name: "Atlanta-Sandy Springs-Alpharetta, GA MSA", category: "MetroArea" }],
      }),
    });
    // Mock: fmr/data returns FMR values
    const mockFmrData = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          county_name: "",
          metro_name: "Atlanta-Sandy Springs-Alpharetta",
          area_name: "Atlanta-Sandy Springs-Alpharetta HMFA",
          smallarea_status: "0",
          basicdata: { Efficiency: "1585", "One-Bedroom": "1660", "Two-Bedroom": "1820", "Three-Bedroom": "2182", "Four-Bedroom": "2605", year: "2026" },
        },
      }),
    });

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("listMetroAreas")) return mockListMetros();
      return mockFmrData();
    });

    const result = await collectHudFmr(ATLANTA_GEO, {
      fetchFn: mockFetch as unknown as typeof fetch,
      hudToken: "test-token-redacted",
    });

    expect(result.status).toBe("ok");
    expect(result.data!.fourBr).toBe(2605);
    expect(result.data!.fmrYear).toContain("2026");
    // Verify token was used in Authorization header but never in result
    const calls = mockFetch.mock.calls as Array<[string, RequestInit]>;
    calls.forEach(([, init]) => {
      const auth = (init?.headers as Record<string, string>)?.["Authorization"] ?? "";
      expect(auth).toContain("Bearer ");
      // Token value not returned in result
      expect(JSON.stringify(result)).not.toContain("test-token-redacted");
    });
    expect(mockListMetros).toHaveBeenCalledTimes(1);
  });

  it("falls back to static data when entity resolution fails", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    const result = await collectHudFmr(ATLANTA_GEO, {
      fetchFn: mockFetch as unknown as typeof fetch,
      hudToken: "test-token-redacted",
    });
    // Falls back to static known data
    expect(result.data).not.toBeNull();
    expect(result.data!.fourBr).toBe(2605);
    expect(result.status).not.toBe("not_verified"); // partial or ok
  });

  it("never includes token in any result field", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
    const result = await collectHudFmr(ATLANTA_GEO, {
      fetchFn: mockFetch as unknown as typeof fetch,
      hudToken: "SUPER_SECRET_KEY_12345",
    });
    expect(JSON.stringify(result)).not.toContain("SUPER_SECRET_KEY_12345");
  });
});

// ─── Income Limits collector ──────────────────────────────────────────────────

describe("collectHudIncomeLimits — no token", () => {
  it("returns not_verified when token absent", async () => {
    const result = await collectHudIncomeLimits(ATLANTA_GEO, { hudToken: undefined });
    expect(result.status).toBe("not_verified");
    expect(result.data).toBeNull();
    expect(result.error).toContain("HUD_TOKEN not configured");
  });
});

describe("collectHudIncomeLimits — mocked token", () => {
  it("parses income limits response correctly", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          county_name: "",
          metro_name: "Atlanta-Sandy Springs-Alpharetta",
          area_name: "Atlanta-Sandy Springs-Alpharetta HMFA",
          year: "2025",
          median_income: "105200",
          il50_p1: "36850",
          il80_p1: "58950",
        },
      }),
    });

    const result = await collectHudIncomeLimits(ATLANTA_GEO, {
      fetchFn: mockFetch as unknown as typeof fetch,
      hudToken: "test-token-redacted",
      entityId: "METRO12060M12060",
    });

    expect(result.status).toBe("ok");
    expect(result.data!.medianIncome).toBe(105200);
    expect(result.data!.il50_p1).toBe(36850);
    expect(result.data!.il80_p1).toBe(58950);
    expect(result.source.confidence).toBe("high");
    expect(JSON.stringify(result)).not.toContain("test-token-redacted");
  });

  it("returns not_verified on HTTP error", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
    const result = await collectHudIncomeLimits(ATLANTA_GEO, {
      fetchFn: mockFetch as unknown as typeof fetch,
      hudToken: "test-token-redacted",
      entityId: "METRO12060M12060",
    });
    expect(result.status).toBe("not_verified");
    expect(result.data).toBeNull();
    expect(result.error).toContain("403");
  });

  it("returns not_verified when no entityId provided", async () => {
    const result = await collectHudIncomeLimits(ATLANTA_GEO, {
      hudToken: "test-token-redacted",
    });
    expect(result.status).toBe("not_verified");
    expect(result.error).toContain("Entity ID not provided");
  });
});

// ─── CHAS collector ───────────────────────────────────────────────────────────

describe("collectHudChas — no token", () => {
  it("returns not_verified when token absent", async () => {
    const result = await collectHudChas(ATLANTA_GEO, { hudToken: undefined });
    expect(result.status).toBe("not_verified");
    expect(result.data).toBeNull();
  });
});

describe("collectHudChas — mocked token", () => {
  beforeEach(() => {
    _clearEntityIdCacheForTesting();
    _clearChasEntityCacheForTesting();
  });

  it("parses county-level CHAS response", async () => {
    // First call: listCounties; second call: chas data
    const mockListCounties = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ county_name: "Fulton County", entity_id: "1300199999" }],
      }),
    });
    const mockChasData = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ A18: "370000", B2: "65000", D8: "45000", D9: "22000" }],
      }),
    });
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("listCounties")) return mockListCounties();
      return mockChasData();
    });

    const result = await collectHudChas(ATLANTA_GEO, {
      fetchFn: mockFetch as unknown as typeof fetch,
      hudToken: "test-token-redacted",
    });

    expect(result.status).toBe("ok");
    expect(result.data!.totalOccupied).toBe(370000);
    expect(result.data!.renterHousingProblems).toBe(65000);
    expect(result.data!.renterCostBurdened30pct).toBe(45000);
    expect(result.data!.renterCostBurdened50pct).toBe(22000);
    expect(result.source.sourceKey).toBe("hud_chas");
    expect(JSON.stringify(result)).not.toContain("test-token-redacted");
  });

  it("falls back to state-level when county resolution fails", async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("listCounties")) {
        return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
      }
      // State-level CHAS
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: [{ A18: "1800000", B2: "280000", D8: "180000", D9: "90000" }],
        }),
      });
    });

    const result = await collectHudChas(ATLANTA_GEO, {
      fetchFn: mockFetch as unknown as typeof fetch,
      hudToken: "test-token-redacted",
    });

    expect(result.status).toBe("partial");
    expect(result.data).not.toBeNull();
    expect(result.data!.totalOccupied).toBe(1800000);
  });

  it("returns not_verified on complete failure", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    const result = await collectHudChas(ATLANTA_GEO, {
      fetchFn: mockFetch as unknown as typeof fetch,
      hudToken: "test-token-redacted",
    });
    expect(result.status).toBe("not_verified");
    expect(result.data).toBeNull();
  });
});

// ─── HUD connection test ──────────────────────────────────────────────────────

describe("testHudConnection — no token", () => {
  it("returns connected=false when token absent", async () => {
    const result = await testHudConnection({ hudToken: undefined });
    expect(result.connected).toBe(false);
    expect(result.httpStatus).toBeNull();
    expect(result.error).toContain("HUD_TOKEN not configured");
    expect(result.testedAt).toBeTruthy();
  });
});

describe("testHudConnection — mocked token", () => {
  it("returns connected=true with geography on success", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ state_name: "Alabama", state_code: "AL", state_num: "1", category: "State" }],
      }),
    });

    const result = await testHudConnection({
      fetchFn: mockFetch as unknown as typeof fetch,
      hudToken: "test-token-redacted",
    });

    expect(result.connected).toBe(true);
    expect(result.httpStatus).toBe(200);
    expect(result.geography).toBe("Alabama");
    expect(result.dataset).toContain("listStates");
    // Token never in result
    expect(JSON.stringify(result)).not.toContain("test-token-redacted");
  });

  it("returns connected=false on HTTP 401", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    const result = await testHudConnection({
      fetchFn: mockFetch as unknown as typeof fetch,
      hudToken: "test-token-redacted",
    });
    expect(result.connected).toBe(false);
    expect(result.httpStatus).toBe(401);
    expect(result.error).toContain("401");
    expect(JSON.stringify(result)).not.toContain("test-token-redacted");
  });

  it("returns connected=false on network timeout", async () => {
    const mockFetch = vi.fn().mockRejectedValue(Object.assign(new Error("Request timed out"), { name: "AbortError" }));
    const result = await testHudConnection({
      fetchFn: mockFetch as unknown as typeof fetch,
      hudToken: "test-token-redacted",
    });
    expect(result.connected).toBe(false);
    expect(result.error).toContain("timed out");
  });

  it("never exposes token in any response field", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [] }) });
    const result = await testHudConnection({
      fetchFn: mockFetch as unknown as typeof fetch,
      hudToken: "MY_VERY_SECRET_TOKEN_XYZ",
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("MY_VERY_SECRET_TOKEN_XYZ");
    // Also check Authorization header was sent (correct side-effect) but not returned
    const calls = mockFetch.mock.calls as Array<[string, RequestInit]>;
    const authHeader = (calls[0][1]?.headers as Record<string, string>)?.["Authorization"] ?? "";
    expect(authHeader).toContain("Bearer MY_VERY_SECRET_TOKEN_XYZ"); // sent correctly
    expect(serialized).not.toContain("Bearer MY_VERY_SECRET_TOKEN_XYZ"); // never returned
  });
});

// ─── Missing-source / not_verified propagation ────────────────────────────────

describe("not_verified propagation", () => {
  it("FMR source has not_verified confidence when data unavailable", async () => {
    const result = await collectHudFmr(UNKNOWN_GEO, { hudToken: undefined });
    expect(result.source.confidence).toBe("not_verified");
    expect(result.source.sourceKey).toBe("hud_fmr");
    expect(result.source.sourceAgency).toBe("U.S. Department of Housing and Urban Development");
    expect(result.source.datasetName).toBeTruthy();
    expect(result.source.retrievedAt).toBeTruthy();
    expect(result.source.geography).toBeTruthy();
  });

  it("CHAS source has not_verified confidence when data unavailable", async () => {
    const result = await collectHudChas(UNKNOWN_GEO, { hudToken: undefined });
    expect(result.source.confidence).toBe("not_verified");
    expect(result.source.sourceKey).toBe("hud_chas");
  });
});
