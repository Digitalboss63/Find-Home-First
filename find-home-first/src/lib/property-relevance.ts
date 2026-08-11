/**
 * property-relevance.ts — Pure local functions for property fit classification.
 *
 * NO server-only imports. NO async. NO RentCast API calls.
 * Safe to import in both server and client contexts.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type NormalizedPropertyType =
  | "Single Family"
  | "Multi Family"
  | "Condo"
  | "Townhouse"
  | "Apartment"
  | "Other";

export type PropertyTypePreference = "preferred" | "acceptable" | "excluded";

export type PropertyTypePreferences = Record<string, PropertyTypePreference>;

export const SUPPORTED_PROPERTY_TYPES: NormalizedPropertyType[] = [
  "Single Family",
  "Multi Family",
  "Condo",
  "Townhouse",
  "Apartment",
  "Other",
];

export type FitClassification = "strong_fit" | "review_needed" | "does_not_meet";

export interface FitReason {
  status: "pass" | "fail" | "missing" | "info";
  text: string;
}

export interface PropertyFitCriteria {
  city?: string | null;
  state?: string | null;
  mapRadiusMi?: number | null;
  propertyTypePreferences?: PropertyTypePreferences | null;
  minimumBedrooms?: number | null;
  minimumBathrooms?: number | null;
  maximumMonthlyLease?: number | null;
  requiredPrivateRoomCapacity?: number | null;
  privateRoomRule?: "one-person-per-bedroom" | null;
  baselineEconomics?: {
    baselineNetMargin: number;
    baselinePropertyRent: number;
    baselineOccupancyPct: number;
    baselineUsableRooms: number;
  } | null;
}

export interface ListingClassification {
  listingId: string;
  fitStatus: FitClassification;
  reasons: FitReason[];
  adjustedMargin: number | null;
  isDuplicate: boolean;
  isSuspectedDuplicate: boolean;
}

// ─── Normalize property type ──────────────────────────────────────────────────

/** Maps RentCast property type strings to our NormalizedPropertyType. */
export function normalizePropertyType(raw: string | null): NormalizedPropertyType | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();

  if (lower === "single family" || lower === "single_family" || lower === "singlefamily") {
    return "Single Family";
  }
  if (
    lower === "multi family" ||
    lower === "multi_family" ||
    lower === "multifamily" ||
    lower === "multiple family"
  ) {
    return "Multi Family";
  }
  if (lower === "condo" || lower === "condominium") {
    return "Condo";
  }
  if (lower === "townhouse" || lower === "townhome") {
    return "Townhouse";
  }
  if (lower === "apartment" || lower === "apt") {
    return "Apartment";
  }
  if (lower === "other" || lower === "sro") {
    return "Other";
  }
  return null; // unknown RentCast type
}

// ─── Address normalization ────────────────────────────────────────────────────

/** Normalize address for dedup: lowercase, expand abbreviations, trim whitespace. */
export function normalizeAddress(addr: string): string {
  if (!addr) return "";
  let s = addr.toLowerCase().trim();
  // Expand common abbreviations
  s = s.replace(/\bst\b\.?/g, "street");
  s = s.replace(/\bave?\b\.?/g, "avenue");
  s = s.replace(/\bblvd\b\.?/g, "boulevard");
  s = s.replace(/\brd\b\.?/g, "road");
  s = s.replace(/\bdr\b\.?/g, "drive");
  s = s.replace(/\bln\b\.?/g, "lane");
  s = s.replace(/\bct\b\.?/g, "court");
  s = s.replace(/\bpl\b\.?/g, "place");
  s = s.replace(/\bpkwy\b\.?/g, "parkway");
  // Normalize whitespace
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/** Extract unit identifier from an address string (e.g. "Unit 4A", "Apt 2", "#3"). */
export function extractUnitId(addr: string): string {
  if (!addr) return "";
  const lower = addr.toLowerCase();
  // Match "unit X", "apt X", "# X", "#X"
  const unitMatch = lower.match(/(?:unit|apt\.?|apartment|#)\s*([a-z0-9-]+)/);
  if (unitMatch) return unitMatch[1];
  return "";
}

/**
 * Extract the base address (before unit identifier) for suspected-duplicate detection.
 * "123 Main St Unit 4A, Atlanta GA" → "123 main st"
 */
function extractBaseAddress(addr: string): string {
  const lower = addr.toLowerCase().trim();
  // Split off unit/apt/# and everything after
  const stripped = lower
    .replace(/[,].*$/, "") // remove city/state after comma
    .replace(/(?:unit|apt\.?|apartment|#)\s*[a-z0-9-]+.*/i, "")
    .trim();
  return stripped;
}

// ─── Adjusted margin formula ──────────────────────────────────────────────────

/**
 * Calculate adjusted margin = baselineNetMargin + baselinePropertyRent - listingPrice
 * Returns null if any input is missing.
 */
export function calculateAdjustedMargin(
  criteria: PropertyFitCriteria,
  listingPrice: number | null
): number | null {
  if (listingPrice == null) return null;
  const eco = criteria.baselineEconomics;
  if (!eco) return null;
  if (eco.baselineNetMargin == null || eco.baselinePropertyRent == null) return null;
  return eco.baselineNetMargin + eco.baselinePropertyRent - listingPrice;
}

// ─── Listing classification ───────────────────────────────────────────────────

interface ListingInput {
  id: string;
  formattedAddress?: string | null;
  addressLine1?: string | null;
  propertyType?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  price?: number | null;
}

/**
 * Classify a single listing against fit criteria.
 *
 * Classification outcome:
 * - Missing/empty address → always does_not_meet
 * - hasFail → does_not_meet
 * - no criterion configured OR hasMissing OR hasAcceptable (no preferred) → review_needed
 * - hasCriterionConfigured AND no fail AND no missing AND (hasPreferred OR all pass) → strong_fit
 */
export function classifyListing(
  listing: ListingInput,
  criteria: PropertyFitCriteria,
  savedLeadIds: Set<string>,
  seenIds: Set<string>,
  seenAddresses: Map<string, string> // base address → first listing id seen
): ListingClassification {
  const reasons: FitReason[] = [];
  let hasFail = false;
  let hasMissing = false;
  let hasAcceptable = false;
  let hasPreferred = false;
  let hasCriterionConfigured = false;

  // ── Address check ────────────────────────────────────────────────────────
  const address = listing.formattedAddress || listing.addressLine1 || "";
  if (!address.trim()) {
    return {
      listingId: listing.id,
      fitStatus: "does_not_meet",
      reasons: [{ status: "fail", text: "Missing or empty address" }],
      adjustedMargin: null,
      isDuplicate: seenIds.has(listing.id),
      isSuspectedDuplicate: false,
    };
  }

  // ── Duplicate detection ──────────────────────────────────────────────────
  const isDuplicate = seenIds.has(listing.id);
  let isSuspectedDuplicate = false;
  const baseAddr = extractBaseAddress(address);
  if (baseAddr) {
    const existingId = seenAddresses.get(baseAddr);
    if (existingId && existingId !== listing.id) {
      isSuspectedDuplicate = true;
    } else if (!existingId) {
      seenAddresses.set(baseAddr, listing.id);
    }
  }

  // ── Property type check ──────────────────────────────────────────────────
  const prefs = criteria.propertyTypePreferences;
  const normalizedType = normalizePropertyType(listing.propertyType ?? null);

  if (prefs && Object.keys(prefs).length > 0) {
    hasCriterionConfigured = true;
    if (normalizedType === null) {
      // Unknown RentCast type → missing
      hasMissing = true;
      reasons.push({ status: "missing", text: `Unknown property type: "${listing.propertyType ?? "none"}"` });
    } else {
      const pref = prefs[normalizedType];
      if (pref === "preferred") {
        hasPreferred = true;
        reasons.push({ status: "pass", text: `Property type "${normalizedType}" is preferred` });
      } else if (pref === "acceptable") {
        hasAcceptable = true;
        reasons.push({ status: "pass", text: `Property type "${normalizedType}" is acceptable` });
      } else if (pref === "excluded") {
        hasFail = true;
        reasons.push({ status: "fail", text: `Property type "${normalizedType}" is excluded` });
      } else {
        // Not in prefs (key absent) → missing
        hasMissing = true;
        reasons.push({ status: "missing", text: `Property type "${normalizedType}" is not configured` });
      }
    }
  } else {
    // No prefs configured → info, no universal exclusion
    reasons.push({ status: "info", text: "No property type preferences configured" });
  }

  // ── Bedrooms check ───────────────────────────────────────────────────────
  if (criteria.minimumBedrooms != null) {
    hasCriterionConfigured = true;
    if (listing.bedrooms == null) {
      hasMissing = true;
      reasons.push({ status: "missing", text: "Bedroom count not available" });
    } else if (listing.bedrooms < criteria.minimumBedrooms) {
      hasFail = true;
      reasons.push({
        status: "fail",
        text: `${listing.bedrooms} bedrooms is below minimum of ${criteria.minimumBedrooms}`,
      });
    } else {
      reasons.push({
        status: "pass",
        text: `${listing.bedrooms} bedrooms meets minimum of ${criteria.minimumBedrooms}`,
      });
    }
  }

  // ── Bathrooms check ──────────────────────────────────────────────────────
  if (criteria.minimumBathrooms != null) {
    hasCriterionConfigured = true;
    if (listing.bathrooms == null) {
      hasMissing = true;
      reasons.push({ status: "missing", text: "Bathroom count not available" });
    } else if (listing.bathrooms < criteria.minimumBathrooms) {
      hasFail = true;
      reasons.push({
        status: "fail",
        text: `${listing.bathrooms} bathrooms is below minimum of ${criteria.minimumBathrooms}`,
      });
    } else {
      reasons.push({
        status: "pass",
        text: `${listing.bathrooms} bathrooms meets minimum of ${criteria.minimumBathrooms}`,
      });
    }
  }

  // ── Max lease check ──────────────────────────────────────────────────────
  if (criteria.maximumMonthlyLease != null) {
    hasCriterionConfigured = true;
    if (listing.price == null) {
      hasMissing = true;
      reasons.push({ status: "missing", text: "Listing price not available" });
    } else if (listing.price > criteria.maximumMonthlyLease) {
      hasFail = true;
      reasons.push({
        status: "fail",
        text: `$${listing.price}/mo exceeds maximum lease of $${criteria.maximumMonthlyLease}/mo`,
      });
    } else {
      reasons.push({
        status: "pass",
        text: `$${listing.price}/mo is within maximum lease of $${criteria.maximumMonthlyLease}/mo`,
      });
    }
  }

  // ── Private room capacity check ──────────────────────────────────────────
  if (
    criteria.requiredPrivateRoomCapacity != null &&
    criteria.privateRoomRule === "one-person-per-bedroom"
  ) {
    hasCriterionConfigured = true;
    if (listing.bedrooms == null) {
      hasMissing = true;
      reasons.push({ status: "missing", text: "Bedroom count unavailable for private room capacity check" });
    } else if (listing.bedrooms < criteria.requiredPrivateRoomCapacity) {
      hasFail = true;
      reasons.push({
        status: "fail",
        text: `${listing.bedrooms} bedrooms insufficient for ${criteria.requiredPrivateRoomCapacity} private rooms`,
      });
    } else {
      reasons.push({
        status: "pass",
        text: `${listing.bedrooms} bedrooms supports ${criteria.requiredPrivateRoomCapacity} private rooms`,
      });
    }
  } else if (criteria.requiredPrivateRoomCapacity != null) {
    // Rule not "one-person-per-bedroom" → missing
    hasMissing = true;
    reasons.push({ status: "missing", text: "Private room capacity rule not applicable" });
  }

  // ── Determine fit status ─────────────────────────────────────────────────
  let fitStatus: FitClassification;

  if (hasFail) {
    fitStatus = "does_not_meet";
  } else if (!hasCriterionConfigured || hasMissing || (hasAcceptable && !hasPreferred)) {
    fitStatus = "review_needed";
  } else {
    // hasCriterionConfigured AND no fail AND no missing AND (hasPreferred OR all pass)
    fitStatus = "strong_fit";
  }

  // ── Adjusted margin ──────────────────────────────────────────────────────
  const adjustedMargin = calculateAdjustedMargin(criteria, listing.price ?? null);

  // Mark id as seen
  seenIds.add(listing.id);

  return {
    listingId: listing.id,
    fitStatus,
    reasons,
    adjustedMargin,
    isDuplicate,
    isSuspectedDuplicate,
  };
}

// ─── Rank listings ────────────────────────────────────────────────────────────

/**
 * Rank classified listings:
 * 1. Saved (in savedLeadIds from criteria context)
 * 2. strong_fit
 * 3. review_needed
 * 4. does_not_meet
 * Within each group: stable (preserves original order).
 */
export function rankListings(
  classified: ListingClassification[]
): ListingClassification[] {
  const order: Record<FitClassification, number> = {
    strong_fit: 0,
    review_needed: 1,
    does_not_meet: 2,
  };

  return [...classified].sort((a, b) => {
    const aOrder = order[a.fitStatus];
    const bOrder = order[b.fitStatus];
    return aOrder - bOrder;
  });
}

// ─── Validate property type preferences ──────────────────────────────────────

/**
 * Validate raw input for property type preferences.
 * Returns validated PropertyTypePreferences or a safe error message.
 */
export function validatePropertyTypePreferences(
  input: unknown
): { valid: true; data: PropertyTypePreferences } | { valid: false; error: string } {
  if (input === null || input === undefined) {
    return { valid: false, error: "Preferences must be an object" };
  }
  if (Array.isArray(input)) {
    return { valid: false, error: "Preferences must be an object, not an array" };
  }
  if (typeof input !== "object") {
    return { valid: false, error: "Preferences must be an object" };
  }

  // Reject prototype-poisoning
  const proto = Object.getPrototypeOf(input);
  if (proto !== Object.prototype && proto !== null) {
    return { valid: false, error: "Preferences object has unexpected prototype" };
  }

  const obj = input as Record<string, unknown>;
  const result: PropertyTypePreferences = {};

  const supportedSet = new Set<string>(SUPPORTED_PROPERTY_TYPES);
  const validValues = new Set<string>(["preferred", "acceptable", "excluded"]);

  for (const key of Object.keys(obj)) {
    // Reject prototype keys
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      return { valid: false, error: `Invalid key: "${key}"` };
    }
    if (!supportedSet.has(key)) {
      return { valid: false, error: `Unknown property type key: "${key}"` };
    }
    const val = obj[key];
    if (typeof val !== "string" || !validValues.has(val)) {
      return { valid: false, error: `Invalid preference value for "${key}": "${val}"` };
    }
    result[key] = val as PropertyTypePreference;
  }

  return { valid: true, data: result };
}
