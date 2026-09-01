/**
 * Pure helpers shared by the property-search client and server actions.
 *
 * Keeping fingerprint generation here prevents the client cache guard and the
 * server-persisted fingerprint from drifting apart. This module must remain
 * synchronous and must not import server-only code.
 */

/**
 * Increment this whenever the RentCast result shape or normalizer logic changes
 * in a way that makes old cached snapshots structurally incompatible with the
 * current code. Mismatched snapshots are discarded and a fresh fetch is forced.
 */
const PROPERTY_RESULTS_SCHEMA_VERSION = 2;

export interface PropertySearchFingerprintInput {
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  propertyType?: string | null;
  minBedrooms?: string | null;
  minBathrooms?: string | null;
  maxRent?: string | null;
  maxDaysListed?: string | null;
  listingStatus?: string | null;
}

export interface AreaSearchFingerprintInput {
  latitude: number;
  longitude: number;
  radiusMiles: number;
  propertyType?: string | null;
  minBedrooms?: string | null;
  minBathrooms?: string | null;
  maxRent?: string | null;
  maxDaysListed?: string | null;
  listingStatus?: string | null;
}

function clean(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export function makePropertySearchFingerprint(
  input: PropertySearchFingerprintInput
): string {
  return JSON.stringify({
    resultSchemaVersion: PROPERTY_RESULTS_SCHEMA_VERSION,
    mode: "criteria",
    city: clean(input.city).toLowerCase(),
    state: clean(input.state).toUpperCase(),
    zipCode: clean(input.zipCode),
    propertyType: clean(input.propertyType),
    minBedrooms: clean(input.minBedrooms),
    minBathrooms: clean(input.minBathrooms),
    maxRent: clean(input.maxRent),
    maxDaysListed: clean(input.maxDaysListed),
    listingStatus: clean(input.listingStatus).toLowerCase() || "active",
  });
}

export function makeAreaSearchFingerprint(
  input: AreaSearchFingerprintInput
): string {
  return JSON.stringify({
    resultSchemaVersion: PROPERTY_RESULTS_SCHEMA_VERSION,
    mode: "map",
    latitude: Number(input.latitude.toFixed(6)),
    longitude: Number(input.longitude.toFixed(6)),
    radiusMiles: input.radiusMiles,
    propertyType: clean(input.propertyType),
    minBedrooms: clean(input.minBedrooms),
    minBathrooms: clean(input.minBathrooms),
    maxRent: clean(input.maxRent),
    maxDaysListed: clean(input.maxDaysListed),
    listingStatus: clean(input.listingStatus).toLowerCase() || "active",
  });
}

/**
 * A saved fingerprint is reusable only when it belongs to a submitted search,
 * the saved snapshot is valid JSON containing an array, AND the stored
 * fingerprint's resultSchemaVersion matches the current schema version.
 *
 * A version mismatch means the cached data was produced by an older normalizer.
 * Returning null forces a fresh paid RentCast fetch on the next search.
 *
 * An empty array is a valid successful result and must be cacheable to avoid
 * paid repeat calls — as long as the schema version matches.
 */
export function restoreSuccessfulFingerprint(input: {
  submitted: boolean;
  queryFingerprint: string | null;
  resultsSnapshot: string | null;
}): string | null {
  if (!input.submitted || !input.queryFingerprint || input.resultsSnapshot == null) {
    return null;
  }

  // Validate schema version before trusting any cached snapshot.
  try {
    const fp = JSON.parse(input.queryFingerprint) as Record<string, unknown>;
    if (fp.resultSchemaVersion !== PROPERTY_RESULTS_SCHEMA_VERSION) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    return Array.isArray(JSON.parse(input.resultsSnapshot))
      ? input.queryFingerprint
      : null;
  } catch {
    return null;
  }
}
