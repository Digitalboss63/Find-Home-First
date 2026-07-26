/**
 * RentCast client tests.
 *
 * Tests:
 * - Response mapping (normalize listing fields)
 * - Error handling (network failure, HTTP 4xx/5xx)
 * - API key never reaches client output
 * - searchRentalListings returns [] when unconfigured
 * - Owner lookup maps owner fields correctly
 * - Owner indicators computed correctly
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

// ─── Fetch mock ───────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function mockOkResponse(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
}

function mockErrorResponse(status: number) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ error: "API error" }),
  });
}

// ─── Listing normalization ────────────────────────────────────────────────────

describe("RentCast response normalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RENTCAST_API_KEY = "test-key-value";
  });

  afterEach(() => {
    delete process.env.RENTCAST_API_KEY;
  });

  it("maps listing fields to RentCastListing shape", async () => {
    const raw = [
      {
        id: "rc-001",
        formattedAddress: "123 Main St, Atlanta, GA 30301",
        addressLine1: "123 Main St",
        city: "Atlanta",
        state: "GA",
        zipCode: "30301",
        propertyType: "Single Family",
        bedrooms: 3,
        bathrooms: 2,
        price: 1800,
        listingType: "Long-Term Rental",
        listingDate: "2026-07-01",
        daysOnMarket: 24,
        lastSeenDate: "2026-07-25",
        status: "Active",
        listedBy: "Jane Doe",
        listedByPhone: "(404) 555-0100",
        listedByEmail: "jane@example.com",
      },
    ];
    mockFetch.mockReturnValue(mockOkResponse(raw));

    const { searchRentalListings } = await import("@/lib/rentcast");
    const result = await searchRentalListings({ city: "Atlanta", state: "GA" });

    expect(result.error).toBeUndefined();
    expect(result.listings).toHaveLength(1);
    const l = result.listings[0];
    expect(l.id).toBe("rc-001");
    expect(l.bedrooms).toBe(3);
    expect(l.bathrooms).toBe(2);
    expect(l.price).toBe(1800);
    expect(l.listedBy).toBe("Jane Doe");
    expect(l.listedByPhone).toBe("(404) 555-0100");
    expect(l.status).toBe("Active");
    expect(l.daysOnMarket).toBe(24);
  });

  it("handles API returning { listings: [...] } wrapper format", async () => {
    const raw = {
      listings: [{ id: "rc-002", formattedAddress: "456 Oak Ave", addressLine1: "456 Oak Ave" }],
    };
    mockFetch.mockReturnValue(mockOkResponse(raw));

    const { searchRentalListings } = await import("@/lib/rentcast");
    const result = await searchRentalListings({ city: "Atlanta" });
    expect(result.listings).toHaveLength(1);
    expect(result.listings[0].id).toBe("rc-002");
  });

  it("returns empty array and error on HTTP 4xx", async () => {
    mockFetch.mockReturnValue(mockErrorResponse(401));

    const { searchRentalListings } = await import("@/lib/rentcast");
    const result = await searchRentalListings({ city: "Atlanta" });
    expect(result.listings).toHaveLength(0);
    expect(result.error).toBeDefined();
    // Error must NOT contain the API key
    expect(result.error).not.toContain("test-key-value");
  });

  it("returns empty array and error on HTTP 5xx", async () => {
    mockFetch.mockReturnValue(mockErrorResponse(500));

    const { searchRentalListings } = await import("@/lib/rentcast");
    const result = await searchRentalListings({ city: "Atlanta" });
    expect(result.listings).toHaveLength(0);
    expect(result.error).toContain("500");
    expect(result.error).not.toContain("test-key-value");
  });

  it("returns empty array and error on network failure", async () => {
    mockFetch.mockRejectedValue(new Error("Network unreachable"));

    const { searchRentalListings } = await import("@/lib/rentcast");
    const result = await searchRentalListings({ city: "Atlanta" });
    expect(result.listings).toHaveLength(0);
    expect(result.error).toBeDefined();
    expect(result.error).not.toContain("test-key-value");
  });

  it("returns { listings: [], error } when API key not configured", async () => {
    delete process.env.RENTCAST_API_KEY;

    const { searchRentalListings } = await import("@/lib/rentcast");
    const result = await searchRentalListings({ city: "Atlanta" });
    expect(result.listings).toHaveLength(0);
    expect(result.error).toBeDefined();
  });
});

// ─── API key never reaches client ─────────────────────────────────────────────

describe("RentCast API key security", () => {
  afterEach(() => { delete process.env.RENTCAST_API_KEY; });

  it("isRentCastConfigured returns false when key absent", async () => {
    delete process.env.RENTCAST_API_KEY;
    const { isRentCastConfigured } = await import("@/lib/rentcast");
    expect(isRentCastConfigured()).toBe(false);
  });

  it("isRentCastConfigured returns true when key present", async () => {
    process.env.RENTCAST_API_KEY = "some-key";
    const { isRentCastConfigured } = await import("@/lib/rentcast");
    expect(isRentCastConfigured()).toBe(true);
  });

  it("NEXT_PUBLIC_RENTCAST_API_KEY must not exist", () => {
    expect(process.env.NEXT_PUBLIC_RENTCAST_API_KEY).toBeUndefined();
  });

  it("error messages from searchRentalListings do not contain API key", async () => {
    process.env.RENTCAST_API_KEY = "super-secret-key-12345";
    mockFetch.mockReturnValue(mockErrorResponse(403));

    const { searchRentalListings } = await import("@/lib/rentcast");
    const result = await searchRentalListings({ city: "Test" });
    expect(result.error).not.toContain("super-secret-key-12345");
  });

  it("X-Api-Key sent in request headers, never in URL query string", async () => {
    // Key is already set in beforeEach. Just verify header vs URL.
    mockFetch.mockReturnValue(mockOkResponse([]));

    const { searchRentalListings } = await import("@/lib/rentcast");
    await searchRentalListings({ city: "Atlanta" });

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;

    // Header must be present and non-empty
    expect(headers["X-Api-Key"]).toBeTruthy();
    // The key value must NOT appear in the URL
    expect(url).not.toContain(headers["X-Api-Key"]);
    // The Accept header must also be set (confirms headers object is properly formed)
    expect(headers["Accept"]).toBe("application/json");
  });
});

// ─── Owner enrichment mapping ─────────────────────────────────────────────────

describe("RentCast owner enrichment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RENTCAST_API_KEY = "test-key";
  });
  afterEach(() => { delete process.env.RENTCAST_API_KEY; });

  it("maps owner fields correctly", async () => {
    const raw = {
      id: "prop-123",
      formattedAddress: "123 Main St",
      ownerOccupied: false,
      owner: {
        names: ["Robert Smith"],
        type: "Individual",
        mailingAddress: "456 Other Rd, Marietta, GA",
      },
    };
    mockFetch.mockReturnValue(mockOkResponse(raw));

    const { getOwnerByPropertyId } = await import("@/lib/rentcast");
    const result = await getOwnerByPropertyId("prop-123");

    expect(result.owner?.ownerName).toBe("Robert Smith");
    expect(result.owner?.ownerType).toBe("Individual");
    expect(result.owner?.ownerOccupied).toBe(false);
    expect(result.owner?.mailingDiffersFromProperty).toBe(true);
  });

  it("computes mailingDiffersFromProperty = false when addresses match", async () => {
    const addr = "123 Main St, Atlanta, GA";
    const raw = {
      id: "prop-456",
      formattedAddress: addr,
      owner: { mailingAddress: addr, type: "Individual" },
    };
    mockFetch.mockReturnValue(mockOkResponse(raw));

    const { getOwnerByPropertyId } = await import("@/lib/rentcast");
    const result = await getOwnerByPropertyId("prop-456");
    expect(result.owner?.mailingDiffersFromProperty).toBe(false);
  });

  it("returns null owner and error on HTTP failure", async () => {
    mockFetch.mockReturnValue(mockErrorResponse(404));
    const { getOwnerByPropertyId } = await import("@/lib/rentcast");
    const result = await getOwnerByPropertyId("bad-id");
    expect(result.owner).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.error).not.toContain("test-key");
  });
});
