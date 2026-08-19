import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ProjectView } from "@/lib/repository";
import { getProjectNextStep } from "@/app/housing-search/ProjectSelector";

function project(currentStatus: string): ProjectView {
  return {
    id: "project-123",
    name: "Test Placement",
    community: "Atlanta, GA",
    currentStatus,
    currentStage: currentStatus === "researching_city" ? "research" : "find-housing",
    targetMoveIn: null,
    blocker: null,
    blockerReason: null,
    nextAction: null,
    residentName: null,
    groupStatus: "active",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

describe("grandma-easy next-step navigation", () => {
  it("sends a project that is ready to the property finder", () => {
    expect(getProjectNextStep(project("finding_property"))).toEqual({
      href: "/housing-search?project=project-123",
      label: "Find Properties",
      helper: "Ready for property search",
      isReady: true,
    });
  });

  it("treats city_approved as ready even though its visible stage is Research", () => {
    const result = getProjectNextStep(project("city_approved"));
    expect(result.label).toBe("Find Properties");
    expect(result.href).toBe("/housing-search?project=project-123");
  });

  it("sends a researching project to its City Report", () => {
    expect(getProjectNextStep(project("researching_city"))).toEqual({
      href: "/projects/project-123/research",
      label: "View City Report",
      helper: "Complete the City Report first",
      isReady: false,
    });
  });

  it("shows the Find Properties action above and below a completed report", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/projects/[id]/research/CityReportPage.tsx"),
      "utf8"
    );

    expect(source).toContain('renderProceedPanel("top")');
    expect(source).toContain('renderProceedPanel("bottom")');
    expect(source).toContain("Proceed to Find Properties →");
  });
});
