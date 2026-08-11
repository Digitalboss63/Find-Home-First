import { describe, expect, it, vi, beforeEach } from "vitest";
import type { MarketReportSnapshot, ProgramOpportunity } from "@/lib/export/types";
import {
  buildReferralPartnerSeeds,
  canUseReferralFinder,
  determinePartnerEligibility,
} from "@/lib/referral-partners";

function program(overrides: Partial<ProgramOpportunity> = {}): ProgramOpportunity {
  return {
    programName: "HUD-VASH",
    fitRank: "Best Immediate",
    populationServed: "Veterans experiencing homelessness",
    assistanceAvailable: "Rental assistance and case management",
    findHomeFirstRole: "External housing operator receiving referrals",
    localAdminOrg: "Atlanta VA Medical Center",
    sharedHousingCompatibility: "Nationally allowable — local verification required",
    leaseRequirements: null,
    inspectionRequirements: null,
    referralProcess: "Contact local HUD-VASH intake",
    currentAvailability: "Capacity not confirmed",
    unresolvedRestrictions: null,
    sourceKey: "va_hudvash",
    reportingDate: "2026-08",
    ...overrides,
  };
}

function report(programs: ProgramOpportunity[]): MarketReportSnapshot {
  return {
    reportId: "report-1", projectId: "project-1", projectName: "Atlanta Veterans",
    version: 1, generatedAt: "2026-08-11T12:00:00Z", dataThroughDate: "2026-08-01",
    geography: { city: "Atlanta", stateAbbr: "GA", cocId: "GA-500", cocName: "Atlanta CoC" },
    targetPopulation: "Veterans", verdict: "Conditional Go", verdictExplanation: "test",
    bestTargetPopulation: "Veterans", bestProgramOpportunity: "HUD-VASH", largestBlocker: "Referral capacity",
    primaryNextAction: "Verify intake", overallScore: 60, confidence: "medium", scorecard: [],
    primaryDemographics: [], allDemographics: [], programs, fmrBenchmarks: [], economicsScenarios: [],
    economicsConclusion: "test", barriers: [], launchSteps: [], primaryNextActionButton: "Continue", sources: [],
  };
}

describe("buildReferralPartnerSeeds", () => {
  it("creates a review-needed source from a concrete official HUD-VASH administrator", () => {
    const result = buildReferralPartnerSeeds(report([program()]));
    expect(result).toEqual(expect.arrayContaining([expect.objectContaining({
      organizationName: "Atlanta VA Medical Center",
      eligibilityStatus: "review_needed",
      sourceUrl: "https://department.va.gov/homeless/hud-vash/",
    })]));
  });

  it("marks a coordinated-entry channel qualified because it explicitly refers externally", () => {
    const result = buildReferralPartnerSeeds(report([program({
      programName: "CoC Rapid Rehousing",
      localAdminOrg: "Partners for HOME",
      sourceKey: "hud_coc",
      referralProcess: "Coordinated Entry System through Partners for HOME",
    })]));
    expect(result[0]).toMatchObject({ eligibilityStatus: "qualified", referralCapacityStatus: "confirmed_external" });
  });

  it("excludes a competing transitional housing program", () => {
    const result = buildReferralPartnerSeeds(report([program({
      programName: "GPD",
      localAdminOrg: "Example Transitional Housing Operator",
      findHomeFirstRole: "Not aligned with Find Home First",
      sharedHousingCompatibility: "Transitional model",
    })]));
    expect(result.find((row) => row.programName === "GPD")).toMatchObject({ eligibilityStatus: "excluded", operatesCompetingHousing: true });
  });

  it("excludes a channel reported as not currently accepting referrals", () => {
    const result = buildReferralPartnerSeeds(report([program({ currentAvailability: "Not currently accepting new referrals" })]));
    expect(result.find((row) => row.programName === "HUD-VASH")).toMatchObject({ eligibilityStatus: "excluded", referralCapacityStatus: "no_external_referrals" });
  });

  it("does not create an organization from a Not Verified placeholder", () => {
    const result = buildReferralPartnerSeeds(report([program({ localAdminOrg: "Not Verified — see directory" })]));
    expect(result.some((row) => row.organizationName.includes("Not Verified"))).toBe(false);
  });

  it("adds the official SSVF directory for a veteran project when no local SSVF provider is known", () => {
    const result = buildReferralPartnerSeeds(report([program()]));
    expect(result).toEqual(expect.arrayContaining([expect.objectContaining({
      organizationName: "VA SSVF Provider Directory",
      partnerCategory: "directory",
      eligibilityStatus: "review_needed",
    })]));
  });

  it("never invents an individual caseworker name", () => {
    const result = buildReferralPartnerSeeds(report([program()]));
    for (const seed of result) expect(seed).not.toHaveProperty("contactName");
  });

  it("does not use nonprofit status as an eligibility factor", () => {
    const source = buildReferralPartnerSeeds.toString().toLowerCase();
    expect(source).not.toContain("nonprofit");
    expect(source).not.toContain("non-profit");
  });
});

describe("determinePartnerEligibility", () => {
  it("qualifies only a confirmed contact with confirmed external referrals", () => {
    expect(determinePartnerEligibility({ verificationStatus: "confirmed", referralCapacityStatus: "confirmed_external", operatesCompetingHousing: false }).status).toBe("qualified");
  });
  it("excludes a competing operator", () => {
    expect(determinePartnerEligibility({ verificationStatus: "confirmed", referralCapacityStatus: "confirmed_external", operatesCompetingHousing: true }).status).toBe("excluded");
  });
  it("excludes a source that does not refer externally", () => {
    expect(determinePartnerEligibility({ verificationStatus: "confirmed", referralCapacityStatus: "no_external_referrals", operatesCompetingHousing: false }).status).toBe("excluded");
  });
  it("keeps unknown capacity in review instead of falsely qualifying it", () => {
    expect(determinePartnerEligibility({ verificationStatus: "official_source", referralCapacityStatus: "needs_confirmation", operatesCompetingHousing: null }).status).toBe("review_needed");
  });
});

describe("referral finder availability", () => {
  it.each([
    "city_approved",
    "finding_property",
    "contacting_owner",
    "application_in_progress",
    "property_approved",
    "preparing_property",
    "seeking_referrals",
    "reviewing_resident",
    "placement_approved",
    "move_in_scheduled",
    "moved_in",
  ])("is available during %s", (status) => {
    expect(canUseReferralFinder(status)).toBe(true);
  });

  it.each(["researching_city", "closed_not_proceeding", "unknown"])(
    "is hidden during %s",
    (status) => {
      expect(canUseReferralFinder(status)).toBe(false);
    }
  );
});

const mocks = vi.hoisted(() => ({
  requireOrganization: vi.fn(), projectBelongsToOrg: vi.fn(), getDb: vi.fn(), getLatestReport: vi.fn(),
  upsertSeeds: vi.fn(), listPartners: vi.fn(), updatePartner: vi.fn(), promote: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ requireOrganization: mocks.requireOrganization }));
vi.mock("@/lib/repository", () => ({ projectBelongsToOrg: mocks.projectBelongsToOrg }));
vi.mock("@/db/client", () => ({ getDb: mocks.getDb }));
vi.mock("@/lib/repository-intelligence", () => ({ getLatestReport: mocks.getLatestReport }));
vi.mock("@/lib/repository-referrals", () => ({
  upsertReferralPartnerSeeds: mocks.upsertSeeds,
  listReferralPartners: mocks.listPartners,
  updateReferralPartner: mocks.updatePartner,
  promoteReferralPartnerToContact: mocks.promote,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("referral finder actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOrganization.mockResolvedValue({ organizationId: "org-server", user: { dbUserId: "user-1" } });
    mocks.projectBelongsToOrg.mockResolvedValue(true);
    mocks.getDb.mockReturnValue({});
    mocks.upsertSeeds.mockResolvedValue(2);
  });

  it("denies a cross-organization project before reading or writing report data", async () => {
    mocks.projectBelongsToOrg.mockResolvedValue(false);
    const { generateReferralPartnersAction } = await import("@/app/projects/[id]/referrals/actions");
    const result = await generateReferralPartnersAction("project-other");
    expect(result.ok).toBe(false);
    expect(mocks.getLatestReport).not.toHaveBeenCalled();
    expect(mocks.upsertSeeds).not.toHaveBeenCalled();
  });

  it("requires a completed City Report", async () => {
    mocks.getLatestReport.mockResolvedValue(null);
    const { generateReferralPartnersAction } = await import("@/app/projects/[id]/referrals/actions");
    const result = await generateReferralPartnersAction("project-1");
    expect(result).toEqual({ ok: false, error: expect.stringContaining("City Report") });
  });

  it("uses the server organization ID when persisting generated candidates", async () => {
    mocks.getLatestReport.mockResolvedValue({ reportJson: JSON.stringify(report([program()])) });
    const { generateReferralPartnersAction } = await import("@/app/projects/[id]/referrals/actions");
    const result = await generateReferralPartnersAction("project-1");
    expect(result.ok).toBe(true);
    expect(mocks.upsertSeeds).toHaveBeenCalledWith(expect.anything(), "org-server", "project-1", expect.any(Array));
  });

  it("prevents promoting an unqualified source when repository returns null", async () => {
    mocks.promote.mockResolvedValue(null);
    const { addQualifiedPartnerToContactsAction } = await import("@/app/projects/[id]/referrals/actions");
    const result = await addQualifiedPartnerToContactsAction("project-1", "candidate-1");
    expect(result.ok).toBe(false);
    expect(result).toEqual({ ok: false, error: expect.stringContaining("qualified") });
  });
});
