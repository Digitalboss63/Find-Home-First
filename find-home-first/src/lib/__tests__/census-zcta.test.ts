/**
 * Unit tests for census-zcta collector.
 *
 * All tests use mocked fetch — no real network calls.
 * Tests cover:
 *   1. Happy path: valid JSON response → parsed ZipDemographicData
 *   2. Root-cause bug: Census returns HTTP 200 with HTML "Missing Key" page
 *      → previously returned null silently; now surfaces a clear error message
 *   3. Invalid API key (still HTML 200, different text)
 *   4. Non-200 HTTP status → surfaces error
 *   5. No ZIPs → returns empty with error
 *   6. CENSUS_API_KEY not configured → returns empty with message
 *   7. Partial success: some ZIPs succeed, some get HTML errors
 *   8. parseZctaResponse edge cases
 */

import { describe, it, expect, vi } from "vitest";
import { collectCensusZcta, parseZctaResponse } from "../market-intelligence/collectors/census-zcta";
import type { GeoContext } from "../market-intelligence/types";

const GEO: GeoContext = {
  city: "Atlanta",
  stateAbbr: "GA",
  stateFips: "13",
  county: "Fulton County",
  metro: "Atlanta-Sandy Springs-Alpharetta, GA",
  fmrArea: "Atlanta-Sandy Springs-Alpharetta, GA HUD Metro FMR Area",
  cocId: "GA-500",
  cocName: "Atlanta CoC",
  phaName: "Atlanta Housing",
};

// Real Census ACS S2101 response for ZCTA 30303 (mocked values for determinism)
const MOCK_CENSUS_ZCTA_RESPONSE = [
  ["NAME", "S2101_C01_001E", "S2101_C03_001E", "S2101_C03_035E", "S2101_C03_036E", "zip code tabulation area"],
  ["ZCTA5 30303", "18500", "1200", "1150", "138", "30303"],
];

function makeMockFetch(
  responses: Record<string, { status: number; contentType: string; body: string }>
): typeof fetch {
  return vi.fn().mockImplementation((url: string) => {
    const zip = String(url).match(/tabulation%20area:(\d{5})/)?.[1] ?? "__default__";
    const spec = responses[zip] ?? responses["__default__"] ?? { status: 200, contentType: "application/json", body: "[]" };
    return Promise.resolve({
      ok: spec.status >= 200 && spec.status < 300,
      status: spec.status,
      headers: new Headers({ "content-type": spec.contentType }),
      json: () => Promise.resolve(JSON.parse(spec.body)),
      text: () => Promise.resolve(spec.body),
    } as unknown as Response);
  });
}

// ─── parseZctaResponse unit tests ────────────────────────────────────────────

describe("parseZctaResponse", () => {
  it("parses a valid Census ACS S2101 row", () => {
    const result = parseZctaResponse(MOCK_CENSUS_ZCTA_RESPONSE, "30303");
    expect(result).not.toBeNull();
    expect(result!.zipCode).toBe("30303");
    expect(result!.civilianPopulation18Plus).toBe(18500);
    expect(result!.veteranPopulation).toBe(1200);
    expect(result!.veteranPct).toBeCloseTo(1200 / 18500, 6);
    expect(result!.povertyRatePct).toBeCloseTo(138 / 1150, 6);
  });

  it("returns null for non-array JSON (HTML parse)", () => {
    expect(parseZctaResponse("<html>Missing Key</html>", "30303")).toBeNull();
    expect(parseZctaResponse({}, "30303")).toBeNull();
    expect(parseZctaResponse(null, "30303")).toBeNull();
  });

  it("returns null for array with fewer than 2 rows (header only)", () => {
    expect(parseZctaResponse([["NAME", "S2101_C01_001E"]], "30303")).toBeNull();
  });

  it("returns null when returned ZCTA is not a 5-digit code", () => {
    const malformed = [
      ["NAME", "S2101_C01_001E", "S2101_C03_001E", "S2101_C03_035E", "S2101_C03_036E", "zip code tabulation area"],
      ["ZCTA5 XXXXX", "18500", "1200", "1150", "138", "XXXXX"],
    ];
    expect(parseZctaResponse(malformed, "30303")).toBeNull();
  });

  it("computes null veteranPct when civilian population is zero", () => {
    const zeroPopResponse = [
      ["NAME", "S2101_C01_001E", "S2101_C03_001E", "S2101_C03_035E", "S2101_C03_036E", "zip code tabulation area"],
      ["ZCTA5 30303", "0", "1200", "1150", "138", "30303"],
    ];
    const result = parseZctaResponse(zeroPopResponse, "30303");
    expect(result).not.toBeNull();
    expect(result!.veteranPct).toBeNull();
  });

  it("computes null povertyRatePct when poverty universe is zero", () => {
    const zeroPovertyUniv = [
      ["NAME", "S2101_C01_001E", "S2101_C03_001E", "S2101_C03_035E", "S2101_C03_036E", "zip code tabulation area"],
      ["ZCTA5 30303", "18500", "1200", "0", "138", "30303"],
    ];
    const result = parseZctaResponse(zeroPovertyUniv, "30303");
    expect(result).not.toBeNull();
    expect(result!.povertyRatePct).toBeNull();
  });
});

// ─── collectCensusZcta integration-style tests ───────────────────────────────

describe("collectCensusZcta — happy path", () => {
  it("returns ok status and populated ZipDemographicData for a valid response", async () => {
    const fetchFn = makeMockFetch({
      "30303": {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_CENSUS_ZCTA_RESPONSE),
      },
    });

    const result = await collectCensusZcta(GEO, ["30303"], { fetchFn, apiKey: "fake-valid-key" });

    expect(result.status).toBe("ok");
    expect(result.data).toHaveLength(1);
    expect(result.data![0].zipCode).toBe("30303");
    expect(result.data![0].veteranPopulation).toBe(1200);
    expect(result.data![0].veteranPct).toBeCloseTo(1200 / 18500, 6);
    expect(result.data![0].povertyRatePct).toBeCloseTo(138 / 1150, 6);
    expect(result.error).toBeUndefined();
  });
});

// ─── Root-cause regression test ──────────────────────────────────────────────

describe("collectCensusZcta — Census HTML 200 'Missing Key' (root-cause bug)", () => {
  it("surfaces a clear error when Census returns HTTP 200 with HTML Missing Key page", async () => {
    const htmlBody = `<html><head><title>Missing Key</title></head><body>You must provide a valid API key.</body></html>`;
    const fetchFn = makeMockFetch({
      "30303": { status: 200, contentType: "text/html; charset=utf-8", body: htmlBody },
    });

    const result = await collectCensusZcta(GEO, ["30303"], { fetchFn, apiKey: "bad-key" });

    expect(result.status).toBe("not_verified");
    expect(result.data).toHaveLength(0);
    // Before this fix: error was generic "Census ACS returned no usable ZCTA veteran records"
    // After this fix: error explicitly mentions that the key was rejected
    expect(result.error).toMatch(/rejected.*CENSUS_API_KEY|key missing or invalid/i);
    expect(result.error).toMatch(/30303/); // includes the ZIP that failed
  });

  it("surfaces a clear error when Census returns HTTP 200 with non-JSON HTML (no key text match)", async () => {
    const htmlBody = `<html><head><title>Error</title></head><body>Something went wrong.</body></html>`;
    const fetchFn = makeMockFetch({
      "30303": { status: 200, contentType: "text/html", body: htmlBody },
    });

    const result = await collectCensusZcta(GEO, ["30303"], { fetchFn, apiKey: "bad-key" });

    expect(result.status).toBe("not_verified");
    expect(result.data).toHaveLength(0);
    expect(result.error).toMatch(/unexpected HTML/i);
  });
});

describe("collectCensusZcta — non-200 HTTP error", () => {
  it("surfaces HTTP status in error when Census returns 400", async () => {
    const fetchFn = makeMockFetch({
      "30303": { status: 400, contentType: "application/json", body: '{"error":"bad request"}' },
    });

    const result = await collectCensusZcta(GEO, ["30303"], { fetchFn, apiKey: "test-key" });

    expect(result.status).toBe("not_verified");
    expect(result.data).toHaveLength(0);
    expect(result.error).toMatch(/HTTP 400/);
  });
});

describe("collectCensusZcta — no candidate ZIPs", () => {
  it("returns not_verified with descriptive error when no ZIP codes provided", async () => {
    const fetchFn = makeMockFetch({});
    const result = await collectCensusZcta(GEO, [], { fetchFn, apiKey: "test-key" });

    expect(result.status).toBe("not_verified");
    expect(result.data).toHaveLength(0);
    expect(result.error).toMatch(/No candidate ZIP/);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("returns not_verified when all ZIPs are invalid format", async () => {
    const fetchFn = makeMockFetch({});
    const result = await collectCensusZcta(GEO, ["1234", "ABCDE", ""], { fetchFn, apiKey: "test-key" });

    expect(result.status).toBe("not_verified");
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("collectCensusZcta — missing API key", () => {
  it("returns not_verified with config-missing message when apiKey is empty", async () => {
    const fetchFn = makeMockFetch({});
    const result = await collectCensusZcta(GEO, ["30303"], { fetchFn, apiKey: "" });

    expect(result.status).toBe("not_verified");
    expect(result.data).toHaveLength(0);
    expect(result.error).toMatch(/CENSUS_API_KEY is not configured/);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("collectCensusZcta — partial success", () => {
  it("returns partial status when some ZIPs succeed and others get HTML 200 error", async () => {
    const htmlBody = `<html><title>Missing Key</title></html>`;
    const fetchFn = makeMockFetch({
      "30303": {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_CENSUS_ZCTA_RESPONSE),
      },
      "30308": {
        status: 200,
        contentType: "text/html",
        body: htmlBody,
      },
    });

    // 2 ZIPs: 30303 succeeds, 30308 returns HTML (simulating key expiry mid-session)
    const result = await collectCensusZcta(GEO, ["30303", "30308"], { fetchFn, apiKey: "partial-key" });

    expect(result.status).toBe("partial");
    expect(result.data).toHaveLength(1);
    expect(result.data![0].zipCode).toBe("30303");
    // Error message should mention the partial failure
    expect(result.error).toMatch(/1 of 2/);
  });

  it("returns ok when all ZIPs succeed", async () => {
    const mockResponse30308 = [
      ["NAME", "S2101_C01_001E", "S2101_C03_001E", "S2101_C03_035E", "S2101_C03_036E", "zip code tabulation area"],
      ["ZCTA5 30308", "22000", "900", "880", "88", "30308"],
    ];
    const fetchFn = makeMockFetch({
      "30303": { status: 200, contentType: "application/json", body: JSON.stringify(MOCK_CENSUS_ZCTA_RESPONSE) },
      "30308": { status: 200, contentType: "application/json", body: JSON.stringify(mockResponse30308) },
    });

    const result = await collectCensusZcta(GEO, ["30303", "30308"], { fetchFn, apiKey: "valid-key" });

    expect(result.status).toBe("ok");
    expect(result.data).toHaveLength(2);
    expect(result.error).toBeUndefined();

    const zip30303 = result.data!.find((d) => d.zipCode === "30303");
    const zip30308 = result.data!.find((d) => d.zipCode === "30308");
    expect(zip30303).toBeDefined();
    expect(zip30308).toBeDefined();
    // Verify they have DIFFERENT Veteran Need inputs (the acceptance criterion)
    expect(zip30303!.veteranPct).not.toBeCloseTo(zip30308!.veteranPct!, 3);
  });
});
