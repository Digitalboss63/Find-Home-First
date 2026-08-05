/**
 * RentCast market data collector for market intelligence.
 * Uses RENTCAST_API_KEY env var. Returns not_verified when key absent.
 * Dependency-injected fetch for testability.
 */
import type { CollectorResult, RentCastMarketData, GeoContext } from "../types";

export interface RentCastMarketConfig {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  apiKey?: string;
}

export async function collectRentCastMarket(
  geo: GeoContext,
  config: RentCastMarketConfig = {}
): Promise<CollectorResult<RentCastMarketData>> {
  const {
    fetchFn = fetch,
    timeoutMs = 15000,
    apiKey = process.env.RENTCAST_API_KEY,
  } = config;
  const now = new Date().toISOString();

  const makeSource = (confidence: "high" | "medium" | "not_verified") => ({
    sourceKey: "rentcast_market",
    sourceAgency: "RentCast",
    datasetName: "Rental Market Statistics",
    directUrl: null as string | null,
    reportingPeriod: now.slice(0, 7),
    geography: `${geo.city}, ${geo.stateAbbr}`,
    retrievedAt: now,
    retrievalMethod: "api" as const,
    confidence,
    isDerived: false,
  });

  if (!apiKey) {
    return {
      data: null,
      status: "not_verified",
      source: makeSource("not_verified"),
      error: "RENTCAST_API_KEY not configured",
    };
  }

  try {
    const url = `https://api.rentcast.io/v1/markets?city=${encodeURIComponent(geo.city)}&state=${encodeURIComponent(geo.stateAbbr)}&bedrooms=4&propertyType=Single%20Family`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchFn(url, {
        headers: { "X-Api-Key": apiKey, Accept: "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        return { data: null, status: "not_verified", source: makeSource("not_verified"), error: `RentCast API error: HTTP ${res.status}` };
      }
      const json = await res.json() as unknown;
      const data = parseRentCastResponse(json);
      if (!data) {
        return { data: null, status: "not_verified", source: makeSource("not_verified"), error: "RentCast response parse failed" };
      }
      return { data, status: "ok", source: makeSource("medium") };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    return { data: null, status: "not_verified", source: makeSource("not_verified"), error: msg };
  }
}

function parseRentCastResponse(json: unknown): RentCastMarketData | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;
  const median = typeof obj["averageRent"] === "number" ? obj["averageRent"] : null;
  const daysOnMarket = typeof obj["averageDaysOnMarket"] === "number" ? obj["averageDaysOnMarket"] : null;
  const listingsCount = typeof obj["totalListings"] === "number" ? obj["totalListings"] : null;
  const listings = Array.isArray(obj["listings"]) ? obj["listings"].slice(0, 5).map((l: unknown) => {
    if (!l || typeof l !== "object") return { address: "Unknown", bedrooms: null, bathrooms: null, rent: null, daysOnMarket: null };
    const r = l as Record<string, unknown>;
    return {
      address: String(r["formattedAddress"] ?? r["address"] ?? "Unknown"),
      bedrooms: typeof r["bedrooms"] === "number" ? r["bedrooms"] : null,
      bathrooms: typeof r["bathrooms"] === "number" ? r["bathrooms"] : null,
      rent: typeof r["price"] === "number" ? r["price"] : null,
      daysOnMarket: typeof r["daysOnMarket"] === "number" ? r["daysOnMarket"] : null,
    };
  }) : [];
  return { medianRent: median, avgDaysOnMarket: daysOnMarket, activeListingsCount: listingsCount, sampleListings: listings };
}
