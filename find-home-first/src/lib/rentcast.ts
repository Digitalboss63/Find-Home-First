/**
 * RentCast API client — server-only.
 *
 * Base URL: https://api.rentcast.io/v1
 * Auth:     X-Api-Key header from RENTCAST_API_KEY env var.
 *
 * SECURITY:
 * - RENTCAST_API_KEY must NEVER appear in client bundles, logs,
 *   error messages, or NEXT_PUBLIC variables.
 * - All functions in this file are server-only.
 * - Never import from "use client" files.
 *
 * Only rental long-term listing endpoints are used.
 * Sale-listing endpoints are intentionally absent — this platform leases.
 */
import "server-only";

const RENTCAST_BASE = "https://api.rentcast.io/v1";

// ─── Types returned to callers ────────────────────────────────────────────────

export interface RentCastListing {
  id: string;
  formattedAddress: string;
  addressLine1: string;
  city: string;
  state: string;
  zipCode: string;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  price: number | null;
  listingType: string | null;
  listingDate: string | null;
  daysOnMarket: number | null;
  lastSeenDate: string | null;
  status: string | null;
  listedBy: string | null;
  listedByPhone: string | null;
  listedByEmail: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface RentCastOwner {
  id: string;
  formattedAddress: string;
  ownerName: string | null;
  ownerType: string | null;   // "Individual" | "Organization" | null
  mailingAddress: string | null;
  ownerOccupied: boolean | null;
  // Derived — not from API directly
  mailingDiffersFromProperty: boolean;
}

/**
 * RentCast /listings/rental/long-term query parameters.
 *
 * Range format: RentCast uses colon-separated range notation for numeric filters.
 *   bedrooms=3:*   means "3 or more" (minimum 3)
 *   bathrooms=2:*  means "2 or more" (minimum 2)
 *   price=*:1800   means "up to $1,800" (maximum 1800)
 *   daysOld=*:45   means "listed within 45 days" (maximum 45)
 *
 * These are constructed in searchRentalListings from the UI fields:
 *   minBedrooms  → bedrooms=VALUE:*
 *   minBathrooms → bathrooms=VALUE:*
 *   maxRent      → price=*:VALUE
 *   maxDaysListed → daysOld=*:VALUE
 *
 * status: "Active" | "Inactive" — omitting defaults to Active on RentCast's side.
 *   We always send the status explicitly to avoid ambiguity.
 *
 * latitude/longitude/radius are reserved for Phase 2 map radius searches.
 */
export interface RentCastSearchParams {
  city?: string;
  state?: string;
  zipCode?: string;
  propertyType?: string;
  /** Minimum bedrooms — sent as bedrooms=VALUE:* */
  minBedrooms?: number;
  /** Minimum bathrooms — sent as bathrooms=VALUE:* */
  minBathrooms?: number;
  /** Maximum monthly rent — sent as price=*:VALUE */
  maxRent?: number;
  /** Maximum days listed — sent as daysOld=*:VALUE */
  maxDaysOld?: number;
  /** "Active" | "Inactive" — always sent explicitly */
  status?: string;
  limit?: number;
  offset?: number;
  /** Phase 2 map: latitude for radius search */
  latitude?: number;
  /** Phase 2 map: longitude for radius search */
  longitude?: number;
  /** Phase 2 map: radius in miles */
  radius?: number;
}

export interface RentCastResult {
  listings: RentCastListing[];
  error?: string;
}

export interface RentCastOwnerResult {
  owner: RentCastOwner | null;
  error?: string;
}

// ─── API key guard ────────────────────────────────────────────────────────────

function getApiKey(): string | null {
  const key = process.env.RENTCAST_API_KEY;
  if (!key || key.trim() === "") return null;
  return key.trim();
}

export function isRentCastConfigured(): boolean {
  return getApiKey() !== null;
}

// ─── Internal fetch helper ────────────────────────────────────────────────────

async function rentcastFetch(
  path: string,
  params: Record<string, string | number | undefined>
): Promise<unknown> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("RENTCAST_API_KEY is not configured");

  const url = new URL(`${RENTCAST_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }

  const response = await fetch(url.toString(), {
    headers: {
      // Key sent in header only — never in URL, body, or logs
      "X-Api-Key": apiKey,
      Accept: "application/json",
    },
    // 15-second timeout via AbortSignal
    signal: AbortSignal.timeout(15_000),
    // Do not cache API responses — always fresh
    cache: "no-store",
  });

  if (!response.ok) {
    // Return status code without leaking key or full URL
    throw new Error(`RentCast API error: HTTP ${response.status}`);
  }

  return response.json();
}

// ─── Normalize listing ────────────────────────────────────────────────────────

function normalizeListing(raw: Record<string, unknown>): RentCastListing {
  return {
    id: String(raw.id ?? ""),
    formattedAddress: String(raw.formattedAddress ?? raw.addressLine1 ?? ""),
    addressLine1: String(raw.addressLine1 ?? ""),
    city: String(raw.city ?? ""),
    state: String(raw.state ?? ""),
    zipCode: String(raw.zipCode ?? ""),
    propertyType: raw.propertyType != null ? String(raw.propertyType) : null,
    bedrooms: raw.bedrooms != null ? Number(raw.bedrooms) : null,
    bathrooms: raw.bathrooms != null ? Number(raw.bathrooms) : null,
    price: raw.price != null ? Number(raw.price) : null,
    listingType: raw.listingType != null ? String(raw.listingType) : null,
    listingDate: raw.listingDate != null ? String(raw.listingDate) : null,
    daysOnMarket: raw.daysOnMarket != null ? Number(raw.daysOnMarket) : null,
    lastSeenDate: raw.lastSeenDate != null ? String(raw.lastSeenDate) : null,
    status: raw.status != null ? String(raw.status) : null,
    listedBy: raw.listedBy != null ? String(raw.listedBy) : null,
    listedByPhone:
      raw.listedByPhone != null ? String(raw.listedByPhone) : null,
    listedByEmail:
      raw.listedByEmail != null ? String(raw.listedByEmail) : null,
    latitude: raw.latitude != null ? Number(raw.latitude) : null,
    longitude: raw.longitude != null ? Number(raw.longitude) : null,
  };
}

// ─── Search rental long-term listings ────────────────────────────────────────

/**
 * Searches RentCast long-term rental listings.
 * Only called when the user explicitly activates "Search Properties".
 */
export async function searchRentalListings(
  params: RentCastSearchParams
): Promise<RentCastResult> {
  try {
    // Build params using RentCast's range notation.
    // rentcastFetch calls url.searchParams.set(k, String(v)) for each non-undefined entry.
    //
    // Range format: "VALUE:*" = at least VALUE, "*:VALUE" = at most VALUE.
    // Plain "VALUE" would mean exact match — incorrect for min/max filters.
    const rawParams: Record<string, string | number | undefined> = {
      city:         params.city,
      state:        params.state,
      zipCode:      params.zipCode,
      propertyType: params.propertyType,
      // Minimum bedrooms: bedrooms=VALUE:* (e.g. bedrooms=3:*)
      bedrooms:     params.minBedrooms !== undefined ? `${params.minBedrooms}:*` : undefined,
      // Minimum bathrooms: bathrooms=VALUE:* (e.g. bathrooms=2:*)
      bathrooms:    params.minBathrooms !== undefined ? `${params.minBathrooms}:*` : undefined,
      // Maximum rent: price=*:VALUE (e.g. price=*:1800) — NOT maxPrice
      price:        params.maxRent !== undefined ? `*:${params.maxRent}` : undefined,
      // Maximum days listed: daysOld=*:VALUE (e.g. daysOld=*:45)
      daysOld:      params.maxDaysOld !== undefined ? `*:${params.maxDaysOld}` : undefined,
      // Status: always sent explicitly. "Active" is the default but we never omit it.
      status:       params.status,
      limit:        params.limit ?? 25,
      offset:       params.offset ?? 0,
    };

    const data = await rentcastFetch("/listings/rental/long-term", rawParams);

    // RentCast returns an array directly or { listings: [...] }
    let raw: unknown[];
    if (Array.isArray(data)) {
      raw = data;
    } else if (
      data !== null &&
      typeof data === "object" &&
      "listings" in (data as object) &&
      Array.isArray((data as Record<string, unknown>).listings)
    ) {
      raw = (data as Record<string, unknown>).listings as unknown[];
    } else {
      raw = [];
    }

    const listings = raw
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map(normalizeListing);

    return { listings };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Log server-side only; never return the raw error to the client
    console.error("[rentcast] searchRentalListings failed:", message);
    return { listings: [], error: message };
  }
}

// ─── Owner enrichment ─────────────────────────────────────────────────────────

/**
 * Fetches owner/property details for a specific RentCast property ID.
 * Called only when the user requests "View Owner Details" or saves a lead.
 * This conserves API quota — enrichment is lazy, never automatic.
 */
export async function getOwnerByPropertyId(
  propertyId: string
): Promise<RentCastOwnerResult> {
  try {
    const data = (await rentcastFetch(`/properties/${encodeURIComponent(propertyId)}`, {})) as Record<string, unknown>;

    const propertyAddr = String(data.formattedAddress ?? data.addressLine1 ?? "");
    const mailingAddr = data.owner != null && typeof data.owner === "object"
      ? String((data.owner as Record<string, unknown>).mailingAddress ?? "")
      : "";

    const ownerData = data.owner != null && typeof data.owner === "object"
      ? (data.owner as Record<string, unknown>)
      : null;

    const owner: RentCastOwner = {
      id: String(data.id ?? propertyId),
      formattedAddress: propertyAddr,
      ownerName: ownerData?.names != null
        ? String(Array.isArray(ownerData.names) ? ownerData.names[0] : ownerData.names)
        : ownerData?.name != null
        ? String(ownerData.name)
        : null,
      ownerType: ownerData?.type != null ? String(ownerData.type) : null,
      mailingAddress: mailingAddr || null,
      ownerOccupied:
        data.ownerOccupied != null ? Boolean(data.ownerOccupied) : null,
      mailingDiffersFromProperty:
        !!mailingAddr &&
        !!propertyAddr &&
        mailingAddr.toLowerCase() !== propertyAddr.toLowerCase(),
    };

    return { owner };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[rentcast] getOwnerByPropertyId failed:", message);
    return { owner: null, error: message };
  }
}

/**
 * Fetches owner details by property address when no ID is available.
 */
export async function getOwnerByAddress(
  address: string
): Promise<RentCastOwnerResult> {
  try {
    const data = (await rentcastFetch("/properties", { address })) as Record<string, unknown>;

    // The address endpoint may return an array or single object
    const item: Record<string, unknown> = Array.isArray(data)
      ? (data[0] as Record<string, unknown>)
      : data;

    if (!item || !item.id) return { owner: null };
    return getOwnerByPropertyId(String(item.id));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[rentcast] getOwnerByAddress failed:", message);
    return { owner: null, error: message };
  }
}
