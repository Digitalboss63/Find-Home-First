import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  canUsePlacementWorkspace,
  isIsoDate,
  placementStageTitle,
  residentPropertyFit,
} from "@/lib/placement-workflow";

describe("placement workspace status access", () => {
  it.each([
    "preparing_property",
    "seeking_referrals",
    "reviewing_resident",
    "placement_approved",
    "move_in_scheduled",
    "moved_in",
  ])("allows %s", (status) => {
    expect(canUsePlacementWorkspace(status)).toBe(true);
  });

  it.each([
    "researching_city",
    "finding_property",
    "contacting_owner",
    "application_in_progress",
    "closed_not_proceeding",
  ])("does not open early for %s", (status) => {
    expect(canUsePlacementWorkspace(status)).toBe(false);
  });
});

describe("resident/property capacity screening", () => {
  it("accepts a bedroom need that fits", () => {
    expect(
      residentPropertyFit({ propertyBedrooms: 4, bedroomsNeeded: 3 }),
    ).toMatchObject({ compatible: true });
  });

  it("accepts an exact bedroom match", () => {
    expect(
      residentPropertyFit({ propertyBedrooms: 3, bedroomsNeeded: 3 }),
    ).toMatchObject({ compatible: true });
  });

  it("blocks a bedroom need larger than the property", () => {
    const result = residentPropertyFit({ propertyBedrooms: 2, bedroomsNeeded: 3 });
    expect(result.compatible).toBe(false);
    expect(result.reason).toContain("needs 3");
  });

  it("requires manual review instead of rejecting when bedroom count is unknown", () => {
    const result = residentPropertyFit({ propertyBedrooms: null, bedroomsNeeded: 2 });
    expect(result.compatible).toBe(true);
    expect(result.reason).toContain("confirm capacity manually");
  });
});

describe("placement dates and stage labels", () => {
  it.each(["2026-08-12", "2028-02-29"])("accepts valid ISO date %s", (date) => {
    expect(isIsoDate(date)).toBe(true);
  });

  it.each(["08/12/2026", "2026-02-30", "", "2026-8-2"])("rejects invalid date %s", (date) => {
    expect(isIsoDate(date)).toBe(false);
  });

  it("provides plain-language titles for the three remaining journey stages", () => {
    expect(placementStageTitle("preparing_property")).toBe("Prepare the Secured Property");
    expect(placementStageTitle("seeking_referrals")).toBe("Find a Qualified Resident");
    expect(placementStageTitle("move_in_scheduled")).toBe("Confirm Move-In");
  });
});

describe("placement action safety contracts", () => {
  const actions = readFileSync(
    join(process.cwd(), "src/app/projects/[id]/placement/actions.ts"),
    "utf8",
  );
  const client = readFileSync(
    join(
      process.cwd(),
      "src/app/projects/[id]/placement/PlacementWorkspaceClient.tsx",
    ),
    "utf8",
  );
  const peoplePage = readFileSync(
    join(process.cwd(), "src/app/people/page.tsx"),
    "utf8",
  );

  it("gets organization scope from server authentication", () => {
    expect(actions).toContain("await requireOrganization()");
    expect(actions).not.toMatch(/input\.organizationId/);
  });

  it("requires every preparation task before opening resident matching", () => {
    expect(actions).toContain("Complete all preparation tasks first");
    expect(actions).toContain('currentStatus: "seeking_referrals"');
  });

  it("does not let resident matching act as an automated eligibility decision", () => {
    expect(client).toContain("The app does not determine resident eligibility or funding");
    expect(actions).toContain("Confirm every resident-match requirement before approval");
  });

  it("prevents assigning one active resident to multiple projects", () => {
    expect(actions).toContain("This resident is already assigned to another project.");
    expect(actions).toContain("ne(projects.id, projectId)");
  });

  it("confirms occupancy before marking the project moved in", () => {
    expect(actions).toContain('currentStatus: "moved_in"');
    expect(actions).toContain('readinessStatus: "occupied"');
    expect(actions).toContain('placementStatus: "placed"');
  });

  it("records each major transition in project status history", () => {
    expect(actions.match(/insert\(projectStatusHistory\)/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it("uses explicit non-submit buttons for state-changing client controls outside forms", () => {
    expect(client).toContain('type="button"');
    expect(client).toContain('type="submit"');
  });

  it("makes the placement workspace discoverable from People & Contacts", () => {
    expect(peoplePage).toContain("Resident Matching &amp; Move-In");
    expect(peoplePage).toContain("/placement`");
  });
});
