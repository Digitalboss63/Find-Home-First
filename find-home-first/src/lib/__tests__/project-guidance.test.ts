import { describe, expect, it } from "vitest";
import {
  buildGuideProjectContext,
  type GuideProjectSnapshot,
  type GuideResearchSnapshot,
} from "@/lib/project-guidance";

function project(overrides: Partial<GuideProjectSnapshot> = {}): GuideProjectSnapshot {
  return {
    id: "project-1",
    name: "Atlanta Veteran Housing",
    community: "Atlanta, GA",
    currentStatus: "researching_city",
    currentStage: "research",
    targetMoveIn: null,
    blocker: null,
    blockerReason: null,
    nextAction: null,
    residentName: null,
    ...overrides,
  };
}

function completeResearch(overrides: Partial<GuideResearchSnapshot> = {}): GuideResearchSnapshot {
  return {
    demandRating: "high",
    demandEvidenceNotes: "Strong local demand evidence",
    fundingSource: "SSVF",
    expectedPaymentPerResident: "900",
    expectedOccupancy: "90",
    expectedPrivateRoomCapacity: "4",
    maxAcceptableLease: "2400",
    estimatedRentalInventory: "35",
    supplySourceLinks: "",
    transportationAccess: "Good transit access",
    locationNotes: "",
    riskFundingUncertainty: false,
    riskInsufficientSupply: false,
    riskRentTooHigh: false,
    riskRegulatoryIssue: false,
    riskWeakReferralPipeline: false,
    riskOther: false,
    riskMitigationNotes: "",
    ...overrides,
  };
}

describe("project-aware FHF Guide", () => {
  it("starts a new placement when there is no active project", () => {
    const context = buildGuideProjectContext({ project: null });

    expect(context.project).toBeNull();
    expect(context.nextAction).toEqual(
      expect.objectContaining({ label: "Start New Placement", href: "/projects/new" })
    );
  });

  it("puts a recorded blocker ahead of the normal stage action", () => {
    const context = buildGuideProjectContext({
      project: project({
        currentStatus: "finding_property",
        currentStage: "find-housing",
        blocker: "Landlord will not approve use",
        blockerReason: "Need another property candidate",
      }),
    });

    expect(context.blocker?.title).toBe("Landlord will not approve use");
    expect(context.nextAction.label).toBe("Resolve project blocker");
    expect(context.nextAction.reason).toBe("Need another property candidate");
  });

  it("uses the existing market-research approval rules to identify missing work", () => {
    const context = buildGuideProjectContext({
      project: project(),
      research: completeResearch({ fundingSource: "" }),
    });

    expect(context.missingItems).toContain("Funding Source");
    expect(context.nextAction.label).toBe("Complete Market Research");
  });

  it("recognizes a missing saved property during property sourcing", () => {
    const context = buildGuideProjectContext({
      project: project({
        currentStatus: "finding_property",
        currentStage: "find-housing",
      }),
      properties: [],
    });

    expect(context.missingItems).toContain("Saved property candidate");
    expect(context.nextAction.label).toBe("Find Properties");
  });

  it("does not flag owner contact as missing when listing contact data exists", () => {
    const context = buildGuideProjectContext({
      project: project({
        currentStatus: "contacting_owner",
        currentStage: "find-housing",
      }),
      properties: [
        {
          id: "lead-1",
          address: "123 Main St",
          ownerId: null,
          listingContact: "Agent Name",
          listingPhone: "555-0100",
          listingEmail: null,
        },
      ],
    });

    expect(context.missingItems).not.toContain("Owner or listing contact information");
    expect(context.nextAction.label).toBe("Continue Owner Outreach");
  });

  it("flags the resident and move-in date when an approved placement is incomplete", () => {
    const context = buildGuideProjectContext({
      project: project({
        currentStatus: "placement_approved",
        currentStage: "match-resident",
        residentName: null,
        targetMoveIn: null,
      }),
    });

    expect(context.missingItems).toContain("Resident linked to this placement");
    expect(context.missingItems).toContain("Target move-in date");
    expect(context.nextAction.label).toBe("Continue Resident Placement");
  });
});
