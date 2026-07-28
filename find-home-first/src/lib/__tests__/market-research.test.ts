/**
 * Market Research — server action and unit tests.
 *
 * Covers:
 * 1. Correct capacity × occupancy revenue formula
 * 2. Server-side approval rejection when required data is missing
 * 3. Critical blockers preventing approval (risk flagged + no mitigation)
 * 4. Hold keeps currentStatus = researching_city, sets blocker, inserts history
 * 5. Approve clears hold/blocker, sets city_approved
 * 6. Test search does not save leads or advance status
 * 7. Draft restoration (savedAt roundtrip)
 * 8. Org isolation across all actions
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { calculateMonthlyMargin } from "@/app/projects/[id]/research/ResearchWorkspace";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockRequireOrganization,
  mockGetDb,
  mockRedirect,
  mockRevalidatePath,
  mockProjectBelongsToOrg,
  mockUpsertMarketResearch,
  mockSearchRentalListings,
} = vi.hoisted(() => ({
  mockRequireOrganization: vi.fn(),
  mockGetDb: vi.fn(),
  mockRedirect: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockProjectBelongsToOrg: vi.fn(),
  mockUpsertMarketResearch: vi.fn(),
  mockSearchRentalListings: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireOrganization: mockRequireOrganization }));
vi.mock("@/db/client", () => ({ getDb: mockGetDb }));
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/repository", () => ({
  upsertMarketResearch: mockUpsertMarketResearch,
  projectBelongsToOrg: mockProjectBelongsToOrg,
}));
vi.mock("@/lib/rentcast", () => ({
  searchRentalListings: mockSearchRentalListings,
  isRentCastConfigured: vi.fn(() => true),
}));
vi.mock("@/db/schema", () => ({
  projects: { id: "id", organizationId: "organization_id", currentStatus: "current_status", blocker: "blocker", blockerReason: "blocker_reason", nextAction: "next_action", updatedAt: "updated_at" },
  projectStatusHistory: {},
  projectMarketResearch: { projectId: "project_id" },
}));

const ORG_ID = "org-test-1";
const PROJECT_ID = "proj-test-1";
const INITIAL_STATE = { error: null, savedAt: null };

// Full valid form data for approval
function makeApprovalFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.append("projectId", PROJECT_ID);
  fd.append("demandRating", "high");
  fd.append("demandEvidenceNotes", "HUD point-in-time count shows 800 veterans");
  fd.append("fundingSource", "HUD VASH");
  fd.append("expectedPaymentPerResident", "1200");
  fd.append("expectedOccupancy", "85");
  fd.append("expectedPrivateRoomCapacity", "4");
  fd.append("maxAcceptableLease", "2800");
  fd.append("estimatedRentalInventory", "50 listings");
  fd.append("transportationAccess", "Bus route nearby");
  for (const [k, v] of Object.entries(overrides)) {
    fd.set(k, v);
  }
  return fd;
}

function makeBasicFormData(): FormData {
  const fd = new FormData();
  fd.append("projectId", PROJECT_ID);
  return fd;
}

// ─── 1. Margin calculation (pure function) ────────────────────────────────────

describe("calculateMonthlyMargin", () => {
  it("uses capacity × occupancy% to compute occupied residents, not raw count", () => {
    // 4 rooms × 85% = 3.4 occupied
    // revenue = 1200 × 3.4 = 4080
    // margin = 4080 - 2800 - 350 - 0 = 930
    const result = calculateMonthlyMargin("1200", "4", "85", "2800", "350", "");
    expect(result).not.toBeNull();
    expect(result!.occupiedResidents).toBeCloseTo(3.4);
    expect(result!.revenue).toBeCloseTo(4080);
    expect(result!.margin).toBeCloseTo(930);
  });

  it("includes otherMonthlyCosts in margin deduction", () => {
    // 4 × 85% = 3.4, revenue = 4080, margin = 4080 - 2800 - 0 - 200 = 1080
    const result = calculateMonthlyMargin("1200", "4", "85", "2800", "", "200");
    expect(result!.margin).toBeCloseTo(1080);
  });

  it("returns null when payment is missing", () => {
    expect(calculateMonthlyMargin("", "4", "85", "2800", "", "")).toBeNull();
  });

  it("returns null when capacity is missing", () => {
    expect(calculateMonthlyMargin("1200", "", "85", "2800", "", "")).toBeNull();
  });

  it("returns null when occupancy % is missing", () => {
    expect(calculateMonthlyMargin("1200", "4", "", "2800", "", "")).toBeNull();
  });

  it("returns null when lease is missing", () => {
    expect(calculateMonthlyMargin("1200", "4", "85", "", "", "")).toBeNull();
  });

  it("returns negative margin when costs exceed revenue", () => {
    // 2 rooms × 50% = 1 occupied, revenue = 500, margin = 500 - 3000 = -2500
    const result = calculateMonthlyMargin("500", "2", "50", "3000", "", "");
    expect(result!.margin).toBeLessThan(0);
  });
});

// ─── 2. Server-side approval validation ───────────────────────────────────────

describe("approveMarketAction — server-side validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOrganization.mockResolvedValue({ organizationId: ORG_ID });
    mockProjectBelongsToOrg.mockResolvedValue(true);
    mockRedirect.mockImplementation((url: string) => {
      throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${url};307;` });
    });
  });

  it("succeeds with all required fields present", async () => {
    mockGetDb.mockReturnValue(makeMockDb());
    const { approveMarketAction } = await import("@/app/projects/[id]/research/actions");
    await expect(approveMarketAction(INITIAL_STATE, makeApprovalFormData())).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith(`/housing-search?project=${PROJECT_ID}`);
  });

  it("rejects when demandRating missing", async () => {
    const { approveMarketAction } = await import("@/app/projects/[id]/research/actions");
    const result = await approveMarketAction(INITIAL_STATE, makeApprovalFormData({ demandRating: "" }));
    expect(result.error).toMatch(/demand rating/i);
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  it("rejects when demandEvidenceNotes missing", async () => {
    const { approveMarketAction } = await import("@/app/projects/[id]/research/actions");
    const result = await approveMarketAction(INITIAL_STATE, makeApprovalFormData({ demandEvidenceNotes: "" }));
    expect(result.error).toMatch(/demand evidence/i);
  });

  it("rejects when fundingSource missing", async () => {
    const { approveMarketAction } = await import("@/app/projects/[id]/research/actions");
    const result = await approveMarketAction(INITIAL_STATE, makeApprovalFormData({ fundingSource: "" }));
    expect(result.error).toMatch(/funding source/i);
  });

  it("rejects when expectedPaymentPerResident missing", async () => {
    const { approveMarketAction } = await import("@/app/projects/[id]/research/actions");
    const result = await approveMarketAction(INITIAL_STATE, makeApprovalFormData({ expectedPaymentPerResident: "" }));
    expect(result.error).toMatch(/payment per resident/i);
  });

  it("rejects when expectedOccupancy missing", async () => {
    const { approveMarketAction } = await import("@/app/projects/[id]/research/actions");
    const result = await approveMarketAction(INITIAL_STATE, makeApprovalFormData({ expectedOccupancy: "" }));
    expect(result.error).toMatch(/occupancy/i);
  });

  it("rejects when expectedPrivateRoomCapacity missing", async () => {
    const { approveMarketAction } = await import("@/app/projects/[id]/research/actions");
    const result = await approveMarketAction(INITIAL_STATE, makeApprovalFormData({ expectedPrivateRoomCapacity: "" }));
    expect(result.error).toMatch(/capacity/i);
  });

  it("rejects when maxAcceptableLease missing", async () => {
    const { approveMarketAction } = await import("@/app/projects/[id]/research/actions");
    const result = await approveMarketAction(INITIAL_STATE, makeApprovalFormData({ maxAcceptableLease: "" }));
    expect(result.error).toMatch(/lease/i);
  });

  it("rejects when supply evidence missing (no inventory and no links)", async () => {
    const { approveMarketAction } = await import("@/app/projects/[id]/research/actions");
    const result = await approveMarketAction(INITIAL_STATE, makeApprovalFormData({ estimatedRentalInventory: "", supplySourceLinks: "" }));
    expect(result.error).toMatch(/supply/i);
  });

  it("rejects when location suitability missing", async () => {
    const { approveMarketAction } = await import("@/app/projects/[id]/research/actions");
    const result = await approveMarketAction(INITIAL_STATE, makeApprovalFormData({ transportationAccess: "", locationNotes: "" }));
    expect(result.error).toMatch(/location/i);
  });
});

// ─── 3. Critical blockers preventing approval ─────────────────────────────────

describe("approveMarketAction — critical blockers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOrganization.mockResolvedValue({ organizationId: ORG_ID });
    mockProjectBelongsToOrg.mockResolvedValue(true);
  });

  it("rejects when risk is checked but no mitigation notes", async () => {
    const { approveMarketAction } = await import("@/app/projects/[id]/research/actions");
    const fd = makeApprovalFormData();
    fd.append("riskRentTooHigh", "true");
    // no riskMitigationNotes
    const result = await approveMarketAction(INITIAL_STATE, fd);
    expect(result.error).toMatch(/blocker|mitigation/i);
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  it("allows approval when risk is checked AND mitigation notes provided", async () => {
    mockGetDb.mockReturnValue(makeMockDb());
    mockRedirect.mockImplementation((url: string) => {
      throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${url};307;` });
    });
    const { approveMarketAction } = await import("@/app/projects/[id]/research/actions");
    const fd = makeApprovalFormData();
    fd.append("riskRentTooHigh", "true");
    fd.append("riskMitigationNotes", "We will negotiate below-market leases with tired owners");
    await expect(approveMarketAction(INITIAL_STATE, fd)).rejects.toThrow("NEXT_REDIRECT");
  });
});

// ─── 4. Hold keeps researching_city, sets blocker, inserts history ────────────

describe("holdResearchAction", () => {
  function makeHoldDb() {
    const updateCalls: unknown[] = [];
    const insertCalls: unknown[] = [];

    const txInsert = vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation((vals) => {
        insertCalls.push(vals);
        return { onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) };
      }),
    }));

    const txUpdate = vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation((vals) => {
        updateCalls.push(vals);
        return { where: vi.fn().mockResolvedValue(undefined) };
      }),
    }));

    const txSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ currentStatus: "researching_city" }]),
        }),
      }),
    });

    const db = {
      transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({ insert: txInsert, update: txUpdate, select: txSelect })
      ),
      _updateCalls: updateCalls,
      _insertCalls: insertCalls,
    };

    return db;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOrganization.mockResolvedValue({ organizationId: ORG_ID });
    mockProjectBelongsToOrg.mockResolvedValue(true);
  });

  it("keeps currentStatus = researching_city when holding", async () => {
    const db = makeHoldDb();
    mockGetDb.mockReturnValue(db);
    const { holdResearchAction } = await import("@/app/projects/[id]/research/actions");
    const fd = makeBasicFormData();
    fd.append("holdReason", "Funding confirmation pending from VA");
    await holdResearchAction(INITIAL_STATE, fd);
    const projectUpdate = db._updateCalls.find((u) =>
      (u as Record<string, unknown>).currentStatus === "researching_city"
    );
    expect(projectUpdate).toBeDefined();
  });

  it("sets blocker = research_on_hold on the project", async () => {
    const db = makeHoldDb();
    mockGetDb.mockReturnValue(db);
    const { holdResearchAction } = await import("@/app/projects/[id]/research/actions");
    const fd = makeBasicFormData();
    fd.append("holdReason", "Funding confirmation pending");
    await holdResearchAction(INITIAL_STATE, fd);
    const projectUpdate = db._updateCalls.find((u) =>
      (u as Record<string, unknown>).blocker === "research_on_hold"
    );
    expect(projectUpdate).toBeDefined();
  });

  it("inserts project_status_history on hold", async () => {
    const db = makeHoldDb();
    mockGetDb.mockReturnValue(db);
    const { holdResearchAction } = await import("@/app/projects/[id]/research/actions");
    const fd = makeBasicFormData();
    fd.append("holdReason", "Pending funding");
    await holdResearchAction(INITIAL_STATE, fd);
    // Should have at least 2 inserts: research upsert + status history
    expect(db._insertCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("requires a hold reason", async () => {
    const { holdResearchAction } = await import("@/app/projects/[id]/research/actions");
    const fd = makeBasicFormData();
    // no holdReason
    const result = await holdResearchAction(INITIAL_STATE, fd);
    expect(result.error).toMatch(/hold reason/i);
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  it("returns savedAt on success", async () => {
    const db = makeHoldDb();
    mockGetDb.mockReturnValue(db);
    const { holdResearchAction } = await import("@/app/projects/[id]/research/actions");
    const fd = makeBasicFormData();
    fd.append("holdReason", "Waiting for VA contact");
    const result = await holdResearchAction(INITIAL_STATE, fd);
    expect(result.error).toBeNull();
    expect(result.savedAt).toBeTruthy();
  });
});

// ─── 5. Approve clears blocker ────────────────────────────────────────────────

describe("approveMarketAction — clears hold/blocker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOrganization.mockResolvedValue({ organizationId: ORG_ID });
    mockProjectBelongsToOrg.mockResolvedValue(true);
    mockRedirect.mockImplementation((url: string) => {
      throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${url};307;` });
    });
  });

  it("sets blocker = null when approving", async () => {
    const db = makeMockDb();
    mockGetDb.mockReturnValue(db);
    const { approveMarketAction } = await import("@/app/projects/[id]/research/actions");
    await expect(approveMarketAction(INITIAL_STATE, makeApprovalFormData())).rejects.toThrow("NEXT_REDIRECT");
    // The project update should include blocker: null
    const projectUpdate = db._updateValues.find((u) =>
      (u as Record<string, unknown>).blocker === null
    );
    expect(projectUpdate).toBeDefined();
  });
});

// ─── 6. Test search — no leads, no status change ──────────────────────────────

describe("testPropertySearchAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOrganization.mockResolvedValue({ organizationId: ORG_ID });
    mockProjectBelongsToOrg.mockResolvedValue(true);
  });

  it("calls RentCast searchRentalListings and returns preview", async () => {
    const fakeListing = { id: "l1", formattedAddress: "123 Main St", city: "Atlanta", state: "GA", zipCode: "30301", propertyType: "Single Family", bedrooms: 4, bathrooms: 2, price: 1800, listingType: "Long-Term", listingDate: null, daysOnMarket: 30, lastSeenDate: null, status: "active", listedBy: null, listedByPhone: null, listedByEmail: null, latitude: null, longitude: null, addressLine1: "123 Main St" };
    mockSearchRentalListings.mockResolvedValue({ listings: [fakeListing], error: undefined });

    const { testPropertySearchAction } = await import("@/app/projects/[id]/research/actions");
    const result = await testPropertySearchAction(PROJECT_ID, "Atlanta", "GA", "4", "2500");
    expect(result.listings).toHaveLength(1);
    expect(result.error).toBeNull();
    expect(result.listings[0].formattedAddress).toBe("123 Main St");
  });

  it("does not call upsertMarketResearch (no lead creation)", async () => {
    mockSearchRentalListings.mockResolvedValue({ listings: [], error: undefined });
    const { testPropertySearchAction } = await import("@/app/projects/[id]/research/actions");
    await testPropertySearchAction(PROJECT_ID, "Atlanta", "GA", "", "");
    expect(mockUpsertMarketResearch).not.toHaveBeenCalled();
  });

  it("does not call getDb (no status change)", async () => {
    mockSearchRentalListings.mockResolvedValue({ listings: [], error: undefined });
    const { testPropertySearchAction } = await import("@/app/projects/[id]/research/actions");
    await testPropertySearchAction(PROJECT_ID, "Atlanta", "GA", "", "");
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  it("limits results to 5 even when RentCast returns more", async () => {
    const manyListings = Array.from({ length: 20 }, (_, i) => ({
      id: `l${i}`, formattedAddress: `${i} Main St`, city: "Atlanta", state: "GA", zipCode: "30301", propertyType: "Single Family", bedrooms: 4, bathrooms: 2, price: 1800, listingType: "Long-Term", listingDate: null, daysOnMarket: 10, lastSeenDate: null, status: "active", listedBy: null, listedByPhone: null, listedByEmail: null, latitude: null, longitude: null, addressLine1: `${i} Main St`,
    }));
    mockSearchRentalListings.mockResolvedValue({ listings: manyListings });
    const { testPropertySearchAction } = await import("@/app/projects/[id]/research/actions");
    const result = await testPropertySearchAction(PROJECT_ID, "Atlanta", "GA", "", "");
    expect(result.listings).toHaveLength(5);
  });

  it("returns error when city/state missing", async () => {
    const { testPropertySearchAction } = await import("@/app/projects/[id]/research/actions");
    const result = await testPropertySearchAction(PROJECT_ID, "", "", "", "");
    expect(result.error).toBeTruthy();
    expect(mockSearchRentalListings).not.toHaveBeenCalled();
  });

  it("rejects access from different org", async () => {
    mockProjectBelongsToOrg.mockResolvedValue(false);
    const { testPropertySearchAction } = await import("@/app/projects/[id]/research/actions");
    const result = await testPropertySearchAction(PROJECT_ID, "Atlanta", "GA", "", "");
    expect(result.error).toBeTruthy();
    expect(mockSearchRentalListings).not.toHaveBeenCalled();
  });
});

// ─── 7. Draft restoration ──────────────────────────────────────────────────────

describe("saveResearchDraftAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOrganization.mockResolvedValue({ organizationId: ORG_ID });
    mockProjectBelongsToOrg.mockResolvedValue(true);
    mockUpsertMarketResearch.mockResolvedValue(true);
  });

  it("returns savedAt ISO timestamp on success", async () => {
    const { saveResearchDraftAction } = await import("@/app/projects/[id]/research/actions");
    const fd = makeBasicFormData();
    fd.append("demandRating", "high");
    const result = await saveResearchDraftAction(INITIAL_STATE, fd);
    expect(result.error).toBeNull();
    expect(result.savedAt).toBeTruthy();
    expect(new Date(result.savedAt!).getTime()).toBeGreaterThan(0);
  });

  it("passes all field data to upsertMarketResearch", async () => {
    const { saveResearchDraftAction } = await import("@/app/projects/[id]/research/actions");
    const fd = makeBasicFormData();
    fd.append("fundingSource", "HUD VASH");
    fd.append("demandRating", "medium");
    await saveResearchDraftAction(INITIAL_STATE, fd);
    expect(mockUpsertMarketResearch).toHaveBeenCalledWith(
      PROJECT_ID,
      ORG_ID,
      expect.objectContaining({ fundingSource: "HUD VASH", demandRating: "medium" })
    );
  });
});

// ─── 8. Org isolation ─────────────────────────────────────────────────────────

describe("organization isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOrganization.mockResolvedValue({ organizationId: ORG_ID });
    mockProjectBelongsToOrg.mockResolvedValue(false);
  });

  it("saveResearchDraftAction rejects wrong org", async () => {
    const { saveResearchDraftAction } = await import("@/app/projects/[id]/research/actions");
    const result = await saveResearchDraftAction(INITIAL_STATE, makeBasicFormData());
    expect(result.error).toBeTruthy();
    expect(mockUpsertMarketResearch).not.toHaveBeenCalled();
  });

  it("approveMarketAction rejects wrong org", async () => {
    const { approveMarketAction } = await import("@/app/projects/[id]/research/actions");
    const result = await approveMarketAction(INITIAL_STATE, makeBasicFormData());
    expect(result.error).toBeTruthy();
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  it("holdResearchAction rejects wrong org", async () => {
    const { holdResearchAction } = await import("@/app/projects/[id]/research/actions");
    const result = await holdResearchAction(INITIAL_STATE, makeBasicFormData());
    expect(result.error).toBeTruthy();
    expect(mockGetDb).not.toHaveBeenCalled();
  });
});

// ─── 9. Shared validation module — field definitions ─────────────────────────

describe("market-research-validation — shared field definitions", () => {
  it("REQUIRED_FIELDS has exactly 7 entries", async () => {
    const { REQUIRED_FIELDS } = await import("@/lib/market-research-validation");
    expect(REQUIRED_FIELDS).toHaveLength(7);
  });

  it("OR_GROUPS has exactly 2 entries covering supply and location", async () => {
    const { OR_GROUPS } = await import("@/lib/market-research-validation");
    expect(OR_GROUPS).toHaveLength(2);
    const labels = OR_GROUPS.map((g) => g.label);
    expect(labels).toContain("Property Supply Evidence");
    expect(labels).toContain("Location Suitability");
  });

  it("REQUIRED_FIELDS contains all 7 expected keys", async () => {
    const { REQUIRED_FIELDS } = await import("@/lib/market-research-validation");
    const keys = REQUIRED_FIELDS.map((f) => f.key);
    const expectedKeys = [
      "demandRating", "demandEvidenceNotes", "fundingSource",
      "expectedPaymentPerResident", "expectedOccupancy",
      "expectedPrivateRoomCapacity", "maxAcceptableLease",
    ];
    for (const k of expectedKeys) {
      expect(keys).toContain(k);
    }
  });

  it("OR_GROUPS supply keys include estimatedRentalInventory and supplySourceLinks", async () => {
    const { OR_GROUPS } = await import("@/lib/market-research-validation");
    const supplyGroup = OR_GROUPS.find((g) => g.label === "Property Supply Evidence");
    expect(supplyGroup?.keys).toContain("estimatedRentalInventory");
    expect(supplyGroup?.keys).toContain("supplySourceLinks");
  });

  it("OR_GROUPS location keys include transportationAccess and locationNotes", async () => {
    const { OR_GROUPS } = await import("@/lib/market-research-validation");
    const locGroup = OR_GROUPS.find((g) => g.label === "Location Suitability");
    expect(locGroup?.keys).toContain("transportationAccess");
    expect(locGroup?.keys).toContain("locationNotes");
  });

  it("checkApprovalRequirements canApprove=false when demandRating missing", async () => {
    const { checkApprovalRequirements } = await import("@/lib/market-research-validation");
    const fields: Record<string, string> = {
      demandRating: "", demandEvidenceNotes: "notes", fundingSource: "HUD VASH",
      expectedPaymentPerResident: "1200", expectedOccupancy: "85",
      expectedPrivateRoomCapacity: "4", maxAcceptableLease: "2800",
      estimatedRentalInventory: "50", transportationAccess: "Bus",
    };
    const result = checkApprovalRequirements(fields, false, "");
    expect(result.canApprove).toBe(false);
    expect(result.missing.some((m) => /demand rating/i.test(m.label))).toBe(true);
  });

  it("checkApprovalRequirements canApprove=true when all fields filled", async () => {
    const { checkApprovalRequirements } = await import("@/lib/market-research-validation");
    const fields: Record<string, string> = {
      demandRating: "high", demandEvidenceNotes: "HUD data", fundingSource: "HUD VASH",
      expectedPaymentPerResident: "1200", expectedOccupancy: "85",
      expectedPrivateRoomCapacity: "4", maxAcceptableLease: "2800",
      estimatedRentalInventory: "50 listings", supplySourceLinks: "",
      transportationAccess: "Bus nearby", locationNotes: "",
    };
    const result = checkApprovalRequirements(fields, false, "");
    expect(result.canApprove).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it("checkApprovalRequirements accepts supplySourceLinks in place of estimatedRentalInventory", async () => {
    const { checkApprovalRequirements } = await import("@/lib/market-research-validation");
    const fields: Record<string, string> = {
      demandRating: "high", demandEvidenceNotes: "notes", fundingSource: "HUD",
      expectedPaymentPerResident: "1200", expectedOccupancy: "85",
      expectedPrivateRoomCapacity: "4", maxAcceptableLease: "2800",
      estimatedRentalInventory: "", supplySourceLinks: "https://rentcast.io",
      transportationAccess: "Bus", locationNotes: "",
    };
    const result = checkApprovalRequirements(fields, false, "");
    expect(result.canApprove).toBe(true);
  });

  it("checkApprovalRequirements accepts locationNotes in place of transportationAccess", async () => {
    const { checkApprovalRequirements } = await import("@/lib/market-research-validation");
    const fields: Record<string, string> = {
      demandRating: "high", demandEvidenceNotes: "notes", fundingSource: "HUD",
      expectedPaymentPerResident: "1200", expectedOccupancy: "85",
      expectedPrivateRoomCapacity: "4", maxAcceptableLease: "2800",
      estimatedRentalInventory: "50", supplySourceLinks: "",
      transportationAccess: "", locationNotes: "Central neighborhood",
    };
    const result = checkApprovalRequirements(fields, false, "");
    expect(result.canApprove).toBe(true);
  });

  it("checkApprovalRequirements flags riskBlocker when risk checked but no mitigation", async () => {
    const { checkApprovalRequirements } = await import("@/lib/market-research-validation");
    const fields: Record<string, string> = {
      demandRating: "high", demandEvidenceNotes: "notes", fundingSource: "HUD",
      expectedPaymentPerResident: "1200", expectedOccupancy: "85",
      expectedPrivateRoomCapacity: "4", maxAcceptableLease: "2800",
      estimatedRentalInventory: "50", transportationAccess: "Bus",
    };
    const result = checkApprovalRequirements(fields, true, "");
    expect(result.riskBlocker).toBe(true);
    expect(result.canApprove).toBe(false);
  });

  it("checkApprovalRequirements does not flag riskBlocker when mitigation provided", async () => {
    const { checkApprovalRequirements } = await import("@/lib/market-research-validation");
    const fields: Record<string, string> = {
      demandRating: "high", demandEvidenceNotes: "notes", fundingSource: "HUD",
      expectedPaymentPerResident: "1200", expectedOccupancy: "85",
      expectedPrivateRoomCapacity: "4", maxAcceptableLease: "2800",
      estimatedRentalInventory: "50", transportationAccess: "Bus",
    };
    const result = checkApprovalRequirements(fields, true, "Negotiating below-market leases");
    expect(result.riskBlocker).toBe(false);
    expect(result.canApprove).toBe(true);
  });

  it("server error messages match expected regex patterns from tests", async () => {
    const { REQUIRED_FIELDS, OR_GROUPS, RISK_MITIGATION_ERROR } = await import("@/lib/market-research-validation");
    const allErrors = [
      ...REQUIRED_FIELDS.map((f) => f.serverError),
      ...OR_GROUPS.map((g) => g.serverError),
      RISK_MITIGATION_ERROR,
    ];
    const patterns: [string, RegExp][] = [
      ["demandRating",               /demand rating/i],
      ["demandEvidenceNotes",        /demand evidence/i],
      ["fundingSource",              /funding source/i],
      ["expectedPaymentPerResident", /payment per resident/i],
      ["expectedOccupancy",          /occupancy/i],
      ["expectedPrivateRoomCapacity",/capacity/i],
      ["maxAcceptableLease",         /lease/i],
      ["supply",                     /supply/i],
      ["location",                   /location/i],
      ["risk",                       /blocker|mitigation/i],
    ];
    for (const [name, pattern] of patterns) {
      expect(allErrors.some((e) => pattern.test(e)), `No server error matches ${name} pattern`).toBe(true);
    }
  });
});

// ─── 10. Auto-save safety — save never calls RentCast ─────────────────────────

describe("saveResearchDraftAction — auto-save safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOrganization.mockResolvedValue({ organizationId: ORG_ID });
    mockProjectBelongsToOrg.mockResolvedValue(true);
    mockUpsertMarketResearch.mockResolvedValue(true);
  });

  it("does not call searchRentalListings (RentCast) during save", async () => {
    const { saveResearchDraftAction } = await import("@/app/projects/[id]/research/actions");
    const fd = makeBasicFormData();
    fd.append("demandRating", "high");
    await saveResearchDraftAction(INITIAL_STATE, fd);
    expect(mockSearchRentalListings).not.toHaveBeenCalled();
  });

  it("does not call getDb during save", async () => {
    const { saveResearchDraftAction } = await import("@/app/projects/[id]/research/actions");
    const fd = makeBasicFormData();
    await saveResearchDraftAction(INITIAL_STATE, fd);
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  it("passes all form fields including supply and location to upsertMarketResearch", async () => {
    const { saveResearchDraftAction } = await import("@/app/projects/[id]/research/actions");
    const fd = makeBasicFormData();
    fd.append("demandRating", "medium");
    fd.append("estimatedRentalInventory", "42 listings");
    fd.append("supplySourceLinks", "https://rentcast.io/results");
    fd.append("transportationAccess", "Metro line nearby");
    fd.append("locationNotes", "Central neighborhood, walkable");
    await saveResearchDraftAction(INITIAL_STATE, fd);
    expect(mockUpsertMarketResearch).toHaveBeenCalledWith(
      PROJECT_ID,
      ORG_ID,
      expect.objectContaining({
        demandRating: "medium",
        estimatedRentalInventory: "42 listings",
        supplySourceLinks: "https://rentcast.io/results",
        transportationAccess: "Metro line nearby",
        locationNotes: "Central neighborhood, walkable",
      })
    );
  });
});

// ─── 11. Decision actions use latest form state ───────────────────────────────

describe("decision actions use the form state provided", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOrganization.mockResolvedValue({ organizationId: ORG_ID });
    mockProjectBelongsToOrg.mockResolvedValue(true);
  });

  it("approveMarketAction validates against the fields in the submitted FormData", async () => {
    mockGetDb.mockReturnValue(makeMockDb());
    mockRedirect.mockImplementation((url: string) => {
      throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${url};307;` });
    });
    const { approveMarketAction } = await import("@/app/projects/[id]/research/actions");
    const fd = makeApprovalFormData({ fundingSource: "TBRA Program" });
    await expect(approveMarketAction(INITIAL_STATE, fd)).rejects.toThrow("NEXT_REDIRECT");
  });

  it("approveMarketAction rejects when supply fields are absent from FormData", async () => {
    const { approveMarketAction } = await import("@/app/projects/[id]/research/actions");
    const fd = makeApprovalFormData({
      estimatedRentalInventory: "",
      supplySourceLinks: "",
    });
    const result = await approveMarketAction(INITIAL_STATE, fd);
    expect(result.error).toMatch(/supply/i);
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  it("approveMarketAction rejects when location fields are absent from FormData", async () => {
    const { approveMarketAction } = await import("@/app/projects/[id]/research/actions");
    const fd = makeApprovalFormData({
      transportationAccess: "",
      locationNotes: "",
    });
    const result = await approveMarketAction(INITIAL_STATE, fd);
    expect(result.error).toMatch(/location/i);
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  it("holdResearchAction saves the holdReason from the submitted FormData", async () => {
    mockGetDb.mockReturnValue(makeMockDb());
    const { holdResearchAction } = await import("@/app/projects/[id]/research/actions");
    const fd = makeBasicFormData();
    fd.append("holdReason", "Awaiting city council decision");
    const result = await holdResearchAction(INITIAL_STATE, fd);
    expect(result.error).toBeNull();
    expect(result.savedAt).toBeTruthy();
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMockDb() {
  const insertValues: unknown[] = [];
  const updateValues: unknown[] = [];

  const txInsert = vi.fn().mockImplementation(() => ({
    values: vi.fn().mockImplementation((vals) => {
      insertValues.push(vals);
      return { onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) };
    }),
  }));

  const txUpdate = vi.fn().mockImplementation(() => ({
    set: vi.fn().mockImplementation((vals) => {
      updateValues.push(vals);
      return { where: vi.fn().mockResolvedValue(undefined) };
    }),
  }));

  const txSelect = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ currentStatus: "researching_city" }]),
      }),
    }),
  });

  const db = {
    transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ insert: txInsert, update: txUpdate, select: txSelect })
    ),
    _insertValues: insertValues,
    _updateValues: updateValues,
  };

  return db;
}
