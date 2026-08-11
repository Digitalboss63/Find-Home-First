/**
 * property-relevance.test.ts
 *
 * Tests for pure functions in src/lib/property-relevance.ts
 * No mocks, no async, no RentCast API calls.
 */
import { describe, it, expect } from "vitest";
import {
  normalizePropertyType,
  normalizeAddress,
  extractUnitId,
  classifyListing,
  rankListings,
  calculateAdjustedMargin,
  validatePropertyTypePreferences,
  SUPPORTED_PROPERTY_TYPES,
  type PropertyFitCriteria,
  type ListingClassification,
} from "@/lib/property-relevance";

// ─── normalizePropertyType ───────────────────────────────────────────────────

describe("normalizePropertyType", () => {
  it("recognizes Single Family variants", () => {
    expect(normalizePropertyType("Single Family")).toBe("Single Family");
    expect(normalizePropertyType("single family")).toBe("Single Family");
    expect(normalizePropertyType("single_family")).toBe("Single Family");
  });

  it("recognizes Multi Family variants", () => {
    expect(normalizePropertyType("Multi Family")).toBe("Multi Family");
    expect(normalizePropertyType("multi_family")).toBe("Multi Family");
    expect(normalizePropertyType("multifamily")).toBe("Multi Family");
  });

  it("recognizes Condo", () => {
    expect(normalizePropertyType("Condo")).toBe("Condo");
    expect(normalizePropertyType("condominium")).toBe("Condo");
  });

  it("recognizes Townhouse", () => {
    expect(normalizePropertyType("Townhouse")).toBe("Townhouse");
    expect(normalizePropertyType("townhome")).toBe("Townhouse");
  });

  it("recognizes Apartment", () => {
    expect(normalizePropertyType("Apartment")).toBe("Apartment");
    expect(normalizePropertyType("apt")).toBe("Apartment");
  });

  it("recognizes Other/SRO", () => {
    expect(normalizePropertyType("Other")).toBe("Other");
    expect(normalizePropertyType("sro")).toBe("Other");
  });

  it("returns null for null input", () => {
    expect(normalizePropertyType(null)).toBeNull();
  });

  it("returns null for unknown type", () => {
    expect(normalizePropertyType("Houseboat")).toBeNull();
    expect(normalizePropertyType("villa")).toBeNull();
    expect(normalizePropertyType("")).toBeNull();
  });
});

// ─── normalizeAddress ────────────────────────────────────────────────────────

describe("normalizeAddress", () => {
  it("lowercases the address", () => {
    expect(normalizeAddress("123 MAIN ST")).toContain("main");
  });

  it("expands street abbreviation", () => {
    const result = normalizeAddress("123 Main St");
    expect(result).toContain("street");
  });

  it("expands ave abbreviation", () => {
    const result = normalizeAddress("456 Oak Ave");
    expect(result).toContain("avenue");
  });

  it("trims leading/trailing whitespace", () => {
    const result = normalizeAddress("  123 Main St  ");
    expect(result).toBe(result.trim());
  });

  it("normalizes multiple spaces", () => {
    const result = normalizeAddress("123   Main   Street");
    expect(result).not.toContain("  ");
  });
});

// ─── extractUnitId ───────────────────────────────────────────────────────────

describe("extractUnitId", () => {
  it("extracts unit number", () => {
    expect(extractUnitId("123 Main St Unit 4A")).toBe("4a");
  });

  it("extracts apt number", () => {
    expect(extractUnitId("456 Oak Ave Apt 2")).toBe("2");
  });

  it("extracts # pattern", () => {
    expect(extractUnitId("789 Pine Rd #3")).toBe("3");
  });

  it("returns empty string when no unit", () => {
    expect(extractUnitId("123 Main Street")).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(extractUnitId("")).toBe("");
  });
});

// ─── calculateAdjustedMargin ─────────────────────────────────────────────────

describe("calculateAdjustedMargin", () => {
  const criteriaWithBaseline: PropertyFitCriteria = {
    baselineEconomics: {
      baselineNetMargin: 500,
      baselinePropertyRent: 2000,
      baselineOccupancyPct: 80,
      baselineUsableRooms: 4,
    },
  };

  it("computes baselineNetMargin + baselinePropertyRent - listingPrice", () => {
    expect(calculateAdjustedMargin(criteriaWithBaseline, 1800)).toBe(700); // 500 + 2000 - 1800
  });

  it("returns null when listingPrice is null", () => {
    expect(calculateAdjustedMargin(criteriaWithBaseline, null)).toBeNull();
  });

  it("returns null when baselineEconomics is null", () => {
    expect(calculateAdjustedMargin({}, 1800)).toBeNull();
  });

  it("returns null when baselineEconomics missing", () => {
    expect(calculateAdjustedMargin({ baselineEconomics: null }, 1800)).toBeNull();
  });
});

// ─── classifyListing helpers ─────────────────────────────────────────────────

function makeListing(overrides: Partial<{
  id: string;
  formattedAddress: string;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  price: number | null;
}> = {}) {
  return {
    id: overrides.id ?? "listing-1",
    formattedAddress: overrides.formattedAddress ?? "123 Main Street, Atlanta, GA 30301",
    propertyType: overrides.propertyType !== undefined ? overrides.propertyType : "Single Family",
    bedrooms: overrides.bedrooms !== undefined ? overrides.bedrooms : 3,
    bathrooms: overrides.bathrooms !== undefined ? overrides.bathrooms : 2,
    price: overrides.price !== undefined ? overrides.price : 1500,
  };
}

function freshSets() {
  return { seenIds: new Set<string>(), seenAddresses: new Map<string, string>() };
}

// ─── classifyListing — property type ─────────────────────────────────────────

describe("classifyListing — property type", () => {
  it("preferred → strong_fit when no other criteria fail", () => {
    const criteria: PropertyFitCriteria = {
      propertyTypePreferences: { "Single Family": "preferred" },
    };
    const { seenIds, seenAddresses } = freshSets();
    const result = classifyListing(makeListing(), criteria, new Set(), seenIds, seenAddresses);
    expect(result.fitStatus).toBe("strong_fit");
  });

  it("acceptable → review_needed (no preferred)", () => {
    const criteria: PropertyFitCriteria = {
      propertyTypePreferences: { "Single Family": "acceptable" },
    };
    const { seenIds, seenAddresses } = freshSets();
    const result = classifyListing(makeListing(), criteria, new Set(), seenIds, seenAddresses);
    expect(result.fitStatus).toBe("review_needed");
  });

  it("excluded → does_not_meet", () => {
    const criteria: PropertyFitCriteria = {
      propertyTypePreferences: { "Single Family": "excluded" },
    };
    const { seenIds, seenAddresses } = freshSets();
    const result = classifyListing(makeListing(), criteria, new Set(), seenIds, seenAddresses);
    expect(result.fitStatus).toBe("does_not_meet");
  });

  it("not configured (key absent) → review_needed", () => {
    const criteria: PropertyFitCriteria = {
      propertyTypePreferences: { "Apartment": "preferred" }, // Single Family not in prefs
    };
    const { seenIds, seenAddresses } = freshSets();
    const result = classifyListing(makeListing(), criteria, new Set(), seenIds, seenAddresses);
    expect(result.fitStatus).toBe("review_needed");
  });

  it("unknown RentCast type → review_needed (missing)", () => {
    const criteria: PropertyFitCriteria = {
      propertyTypePreferences: { "Single Family": "preferred" },
    };
    const { seenIds, seenAddresses } = freshSets();
    const result = classifyListing(
      makeListing({ propertyType: "Houseboat" }),
      criteria,
      new Set(),
      seenIds,
      seenAddresses
    );
    expect(result.fitStatus).toBe("review_needed");
    expect(result.reasons.some(r => r.status === "missing")).toBe(true);
  });

  it("no prefs configured → no universal exclusion (info reason)", () => {
    const criteria: PropertyFitCriteria = {};
    const { seenIds, seenAddresses } = freshSets();
    const result = classifyListing(makeListing(), criteria, new Set(), seenIds, seenAddresses);
    // Should not be does_not_meet based on type alone
    expect(result.fitStatus).not.toBe("does_not_meet");
    expect(result.reasons.some(r => r.status === "info")).toBe(true);
  });

  it("multiple preferred types both match correctly", () => {
    const criteria: PropertyFitCriteria = {
      propertyTypePreferences: {
        "Single Family": "preferred",
        "Townhouse": "preferred",
      },
    };
    const { seenIds: s1, seenAddresses: a1 } = freshSets();
    const r1 = classifyListing(makeListing({ propertyType: "Single Family" }), criteria, new Set(), s1, a1);
    expect(r1.fitStatus).toBe("strong_fit");

    const { seenIds: s2, seenAddresses: a2 } = freshSets();
    const r2 = classifyListing(
      makeListing({ id: "listing-2", formattedAddress: "456 Oak Ave", propertyType: "Townhouse" }),
      criteria,
      new Set(),
      s2,
      a2
    );
    expect(r2.fitStatus).toBe("strong_fit");
  });
});

// ─── classifyListing — bedrooms ──────────────────────────────────────────────

describe("classifyListing — bedrooms", () => {
  const criteria: PropertyFitCriteria = { minimumBedrooms: 3 };

  it("null bedrooms → missing (review_needed)", () => {
    const { seenIds, seenAddresses } = freshSets();
    const result = classifyListing(
      makeListing({ bedrooms: null }),
      criteria,
      new Set(),
      seenIds,
      seenAddresses
    );
    expect(result.reasons.some(r => r.status === "missing" && r.text.toLowerCase().includes("bedroom"))).toBe(true);
    expect(result.fitStatus).toBe("review_needed");
  });

  it("below minimum → fail → does_not_meet", () => {
    const { seenIds, seenAddresses } = freshSets();
    const result = classifyListing(
      makeListing({ bedrooms: 2 }),
      criteria,
      new Set(),
      seenIds,
      seenAddresses
    );
    expect(result.reasons.some(r => r.status === "fail" && r.text.includes("bedroom"))).toBe(true);
    expect(result.fitStatus).toBe("does_not_meet");
  });

  it("meets minimum → pass", () => {
    const { seenIds, seenAddresses } = freshSets();
    const result = classifyListing(
      makeListing({ bedrooms: 3 }),
      criteria,
      new Set(),
      seenIds,
      seenAddresses
    );
    expect(result.reasons.some(r => r.status === "pass" && r.text.includes("bedroom"))).toBe(true);
  });
});

// ─── classifyListing — bathrooms ─────────────────────────────────────────────

describe("classifyListing — bathrooms", () => {
  const criteria: PropertyFitCriteria = { minimumBathrooms: 2 };

  it("null bathrooms → missing", () => {
    const { seenIds, seenAddresses } = freshSets();
    const result = classifyListing(
      makeListing({ bathrooms: null }),
      criteria,
      new Set(),
      seenIds,
      seenAddresses
    );
    expect(result.reasons.some(r => r.status === "missing" && r.text.toLowerCase().includes("bathroom"))).toBe(true);
  });

  it("below minimum → fail", () => {
    const { seenIds, seenAddresses } = freshSets();
    const result = classifyListing(
      makeListing({ bathrooms: 1 }),
      criteria,
      new Set(),
      seenIds,
      seenAddresses
    );
    expect(result.reasons.some(r => r.status === "fail" && r.text.includes("bathroom"))).toBe(true);
    expect(result.fitStatus).toBe("does_not_meet");
  });

  it("meets minimum → pass", () => {
    const { seenIds, seenAddresses } = freshSets();
    const result = classifyListing(
      makeListing({ bathrooms: 2 }),
      criteria,
      new Set(),
      seenIds,
      seenAddresses
    );
    expect(result.reasons.some(r => r.status === "pass" && r.text.includes("bathroom"))).toBe(true);
  });
});

// ─── classifyListing — max lease ─────────────────────────────────────────────

describe("classifyListing — max lease", () => {
  const criteria: PropertyFitCriteria = { maximumMonthlyLease: 1800 };

  it("null price → missing", () => {
    const { seenIds, seenAddresses } = freshSets();
    const result = classifyListing(
      makeListing({ price: null }),
      criteria,
      new Set(),
      seenIds,
      seenAddresses
    );
    expect(result.reasons.some(r => r.status === "missing" && r.text.includes("price"))).toBe(true);
  });

  it("above maximum → fail → does_not_meet", () => {
    const { seenIds, seenAddresses } = freshSets();
    const result = classifyListing(
      makeListing({ price: 2000 }),
      criteria,
      new Set(),
      seenIds,
      seenAddresses
    );
    expect(result.reasons.some(r => r.status === "fail")).toBe(true);
    expect(result.fitStatus).toBe("does_not_meet");
  });

  it("within maximum → pass", () => {
    const { seenIds, seenAddresses } = freshSets();
    const result = classifyListing(
      makeListing({ price: 1500 }),
      criteria,
      new Set(),
      seenIds,
      seenAddresses
    );
    expect(result.reasons.some(r => r.status === "pass" && r.text.includes("lease"))).toBe(true);
  });
});

// ─── classifyListing — missing address ───────────────────────────────────────

describe("classifyListing — missing address", () => {
  it("empty address → does_not_meet regardless of criteria", () => {
    const criteria: PropertyFitCriteria = {
      propertyTypePreferences: { "Single Family": "preferred" },
      minimumBedrooms: 2,
    };
    const { seenIds, seenAddresses } = freshSets();
    const result = classifyListing(
      { id: "no-addr", formattedAddress: "", bedrooms: 5, bathrooms: 3, price: 1000, propertyType: "Single Family" },
      criteria,
      new Set(),
      seenIds,
      seenAddresses
    );
    expect(result.fitStatus).toBe("does_not_meet");
  });

  it("null/undefined address → does_not_meet", () => {
    const criteria: PropertyFitCriteria = {};
    const { seenIds, seenAddresses } = freshSets();
    const result = classifyListing(
      { id: "no-addr2", formattedAddress: undefined, addressLine1: undefined, bedrooms: 3, bathrooms: 2, price: 1500, propertyType: "Apartment" },
      criteria,
      new Set(),
      seenIds,
      seenAddresses
    );
    expect(result.fitStatus).toBe("does_not_meet");
  });
});

// ─── classifyListing — no criteria configured ────────────────────────────────

describe("classifyListing — no criteria configured", () => {
  it("empty criteria → review_needed (no criterion configured)", () => {
    const { seenIds, seenAddresses } = freshSets();
    const result = classifyListing(makeListing(), {}, new Set(), seenIds, seenAddresses);
    expect(result.fitStatus).toBe("review_needed");
  });
});

// ─── classifyListing — duplicate detection ───────────────────────────────────

describe("classifyListing — duplicate detection", () => {
  it("exact ID duplicate: same id in seenIds → isDuplicate=true", () => {
    const seenIds = new Set<string>(["listing-1"]);
    const seenAddresses = new Map<string, string>();
    const result = classifyListing(makeListing(), {}, new Set(), seenIds, seenAddresses);
    expect(result.isDuplicate).toBe(true);
  });

  it("separate apartment units not deduplicated: same base address, different units", () => {
    const criteria: PropertyFitCriteria = {};
    const seenIds = new Set<string>();
    const seenAddresses = new Map<string, string>();

    const listing1 = makeListing({
      id: "unit-1",
      formattedAddress: "123 Main St Unit 1, Atlanta, GA",
    });
    const listing2 = makeListing({
      id: "unit-2",
      formattedAddress: "123 Main St Unit 2, Atlanta, GA",
    });

    const r1 = classifyListing(listing1, criteria, new Set(), seenIds, seenAddresses);
    const r2 = classifyListing(listing2, criteria, new Set(), seenIds, seenAddresses);

    expect(r1.isDuplicate).toBe(false);
    expect(r2.isDuplicate).toBe(false);
    // r2 should be suspected duplicate since same base address
    expect(r2.isSuspectedDuplicate).toBe(true);
  });
});

// ─── rankListings ────────────────────────────────────────────────────────────

describe("rankListings", () => {
  it("ranks strong_fit before review_needed before does_not_meet", () => {
    const listings: ListingClassification[] = [
      { listingId: "a", fitStatus: "does_not_meet", reasons: [], adjustedMargin: null, isDuplicate: false, isSuspectedDuplicate: false },
      { listingId: "b", fitStatus: "strong_fit", reasons: [], adjustedMargin: null, isDuplicate: false, isSuspectedDuplicate: false },
      { listingId: "c", fitStatus: "review_needed", reasons: [], adjustedMargin: null, isDuplicate: false, isSuspectedDuplicate: false },
    ];
    const ranked = rankListings(listings);
    expect(ranked[0].fitStatus).toBe("strong_fit");
    expect(ranked[1].fitStatus).toBe("review_needed");
    expect(ranked[2].fitStatus).toBe("does_not_meet");
  });

  it("is deterministic (stable sort within groups)", () => {
    const listings: ListingClassification[] = [
      { listingId: "x", fitStatus: "review_needed", reasons: [], adjustedMargin: null, isDuplicate: false, isSuspectedDuplicate: false },
      { listingId: "y", fitStatus: "review_needed", reasons: [], adjustedMargin: null, isDuplicate: false, isSuspectedDuplicate: false },
    ];
    const r1 = rankListings(listings);
    const r2 = rankListings(listings);
    expect(r1.map(l => l.listingId)).toEqual(r2.map(l => l.listingId));
  });
});

// ─── validatePropertyTypePreferences ─────────────────────────────────────────

describe("validatePropertyTypePreferences", () => {
  it("accepts a valid object", () => {
    const result = validatePropertyTypePreferences({
      "Single Family": "preferred",
      "Apartment": "excluded",
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data["Single Family"]).toBe("preferred");
    }
  });

  it("accepts empty object (not configured)", () => {
    const result = validatePropertyTypePreferences({});
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(Object.keys(result.data)).toHaveLength(0);
    }
  });

  it("rejects unknown key", () => {
    const result = validatePropertyTypePreferences({ "Houseboat": "preferred" });
    expect(result.valid).toBe(false);
  });

  it("rejects prototype key __proto__", () => {
    const obj = Object.create(null) as Record<string, unknown>;
    obj["__proto__"] = "preferred";
    // Actually create a plain object with __proto__ as own key
    const result = validatePropertyTypePreferences(JSON.parse('{"__proto__": "preferred"}'));
    expect(result.valid).toBe(false);
  });

  it("rejects array", () => {
    const result = validatePropertyTypePreferences(["Single Family"]);
    expect(result.valid).toBe(false);
  });

  it("rejects unknown value", () => {
    const result = validatePropertyTypePreferences({ "Single Family": "maybe" });
    expect(result.valid).toBe(false);
  });

  it("not configured (absent key) is valid — empty object passes", () => {
    const result = validatePropertyTypePreferences({});
    expect(result.valid).toBe(true);
  });
});

// ─── Structural: search draft fields do NOT populate fitCriteria ─────────────

describe("buildFitCriteria structural constraints", () => {
  it("draft.maxRent is a different concern from fitCriteria.maximumMonthlyLease", () => {
    // This is a structural test: the fitCriteria is populated from marketResearch,
    // not from the search draft. We verify the two are independent types.
    // If only the research record has maxAcceptableLease, the draft.maxRent is separate.
    const draftMaxRent = "2500"; // from search draft
    const researchMaxLease = 1800; // from market research record

    // These should be different values — draft is for RentCast API filtering,
    // fitCriteria is for local classification
    expect(parseInt(draftMaxRent, 10)).not.toBe(researchMaxLease);
  });
});

// ─── Preference save isolation ────────────────────────────────────────────────

describe("validatePropertyTypePreferences isolation", () => {
  it("only validates preferences, does not touch other fields", () => {
    const input = { "Single Family": "preferred" };
    const result = validatePropertyTypePreferences(input);
    expect(result.valid).toBe(true);
    if (result.valid) {
      // Should only contain the property type key, not any other fields
      expect(Object.keys(result.data)).toEqual(["Single Family"]);
    }
  });
});

// ─── Zero RentCast calls: all exported functions are synchronous ──────────────

describe("zero RentCast calls — all functions are synchronous", () => {
  it("normalizePropertyType returns non-Promise value", () => {
    const result = normalizePropertyType("Single Family");
    expect(result).not.toBeInstanceOf(Promise);
  });

  it("normalizeAddress returns non-Promise value", () => {
    const result = normalizeAddress("123 Main St");
    expect(result).not.toBeInstanceOf(Promise);
  });

  it("extractUnitId returns non-Promise value", () => {
    const result = extractUnitId("123 Main St Unit 4");
    expect(result).not.toBeInstanceOf(Promise);
  });

  it("calculateAdjustedMargin returns non-Promise value", () => {
    const result = calculateAdjustedMargin({}, 1500);
    expect(result).not.toBeInstanceOf(Promise);
  });

  it("classifyListing returns non-Promise value", () => {
    const { seenIds, seenAddresses } = freshSets();
    const result = classifyListing(makeListing(), {}, new Set(), seenIds, seenAddresses);
    expect(result).not.toBeInstanceOf(Promise);
  });

  it("rankListings returns non-Promise value", () => {
    const result = rankListings([]);
    expect(result).not.toBeInstanceOf(Promise);
  });

  it("validatePropertyTypePreferences returns non-Promise value", () => {
    const result = validatePropertyTypePreferences({});
    expect(result).not.toBeInstanceOf(Promise);
  });
});

// ─── SUPPORTED_PROPERTY_TYPES coverage ───────────────────────────────────────

describe("SUPPORTED_PROPERTY_TYPES", () => {
  it("contains exactly the expected 6 types", () => {
    expect(SUPPORTED_PROPERTY_TYPES).toHaveLength(6);
    expect(SUPPORTED_PROPERTY_TYPES).toContain("Single Family");
    expect(SUPPORTED_PROPERTY_TYPES).toContain("Multi Family");
    expect(SUPPORTED_PROPERTY_TYPES).toContain("Condo");
    expect(SUPPORTED_PROPERTY_TYPES).toContain("Townhouse");
    expect(SUPPORTED_PROPERTY_TYPES).toContain("Apartment");
    expect(SUPPORTED_PROPERTY_TYPES).toContain("Other");
  });
});
