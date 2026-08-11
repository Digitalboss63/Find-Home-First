/**
 * Pure helpers shared by the property-search client and server actions.
 *
 * Keeping fingerprint generation here prevents the client cache guard and the
 * server-persisted fingerprint from drifting apart. This module must remain
 * synchronous and must not import server-only code.
 */

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
 * A saved fingerprint is reusable only when it belongs to a submitted search
 * and the saved snapshot is valid JSON containing an array. An empty array is
 * a valid successful result and must be cacheable to avoid paid repeat calls.
 */
export function restoreSuccessfulFingerprint(input: {
  submitted: boolean;
  queryFingerprint: string | null;
  resultsSnapshot: string | null;
}): string | null {
  if (!input.submitted || !input.queryFingerprint || input.resultsSnapshot == null) {
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
