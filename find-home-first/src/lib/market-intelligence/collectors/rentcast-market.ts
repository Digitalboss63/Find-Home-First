/**
 * RentCast rental-listing collector for market intelligence.
 * Uses the supported long-term rental listings endpoint so FHF can rank ZIPs.
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
  const { fetchFn = fetch, timeoutMs = 15000, apiKey = process.env.RENTCAST_API_KEY } = config;
  const now = new Date().toISOString();
  const makeSource = (confidence: "high" | "medium" | "not_verified") => ({
    sourceKey: "rentcast_market",
    sourceAgency: "RentCast",
    datasetName: "Active Long-Term Rental Listings",
    directUrl: "https://api.rentcast.io/v1/listings/rental/long-term",
    reportingPeriod: now.slice(0, 7),
    geography: `${geo.city}, ${geo.stateAbbr}`,
    retrievedAt: now,
    retrievalMethod: "api" as const,
    confidence,
    isDerived: false,
  });

  if (!apiKey) return { data: null, status: "not_verified", source: makeSource("not_verified"), error: "RENTCAST_API_KEY not configured" };

  try {
    const url = `https://api.rentcast.io/v1/listings/rental/long-term?city=${encodeURIComponent(geo.city)}&state=${encodeURIComponent(geo.stateAbbr)}&status=Active&propertyType=Single%20Family&bedrooms=3:*&limit=200&includeTotalCount=true`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchFn(url, { headers: { "X-Api-Key": apiKey, Accept: "application/json" }, signal: controller.signal });
      if (!res.ok) return { data: null, status: "not_verified", source: makeSource("not_verified"), error: `RentCast API error: HTTP ${res.status}` };
      const json = await res.json() as unknown;
      const totalHeader = res.headers.get("x-total-count");
      const data = parseRentCastResponse(json, totalHeader ? Number(totalHeader) : null);
      if (!data) return { data: null, status: "not_verified", source: makeSource("not_verified"), error: "RentCast response parse failed" };
      return { data, status: "ok", source: makeSource("high") };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    return { data: null, status: "not_verified", source: makeSource("not_verified"), error: err instanceof Error ? err.message : "Network error" };
  }
}

function parseRentCastResponse(json: unknown, totalCount: number | null): RentCastMarketData | null {
  if (!Array.isArray(json)) return null;
  const listings = json.map((l: unknown) => {
    const r = (l && typeof l === "object" ? l : {}) as Record<string, unknown>;
    const address = String(r["formattedAddress"] ?? r["address"] ?? "Unknown");
    const explicitZip = typeof r["zipCode"] === "string" ? r["zipCode"] : null;
    const zipFromAddress = address.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1] ?? null;
    const listedDate = typeof r["listedDate"] === "string" ? new Date(r["listedDate"]) : null;
    const daysOnMarket = typeof r["daysOnMarket"] === "number"
      ? r["daysOnMarket"]
      : listedDate && !Number.isNaN(listedDate.getTime())
        ? Math.max(0, Math.floor((Date.now() - listedDate.getTime()) / 86400000))
        : null;
    return {
      address,
      zipCode: explicitZip ?? zipFromAddress,
      propertyType: typeof r["propertyType"] === "string" ? r["propertyType"] : null,
      bedrooms: typeof r["bedrooms"] === "number" ? r["bedrooms"] : null,
      bathrooms: typeof r["bathrooms"] === "number" ? r["bathrooms"] : null,
      rent: typeof r["price"] === "number" ? r["price"] : null,
      daysOnMarket,
    };
  });
  const rents = listings.map((l) => l.rent).filter((v): v is number => typeof v === "number").sort((a, b) => a - b);
  const dom = listings.map((l) => l.daysOnMarket).filter((v): v is number => typeof v === "number");
  const medianRent = rents.length ? rents[Math.floor(rents.length / 2)] : null;
  const avgDaysOnMarket = dom.length ? dom.reduce((a, b) => a + b, 0) / dom.length : null;
  return {
    medianRent,
    avgDaysOnMarket,
    activeListingsCount: Number.isFinite(totalCount) ? totalCount : listings.length,
    sampleListings: listings,
  };
}
