import { describe, expect, it } from "vitest";
import {
  buildGuideSpotlightInstruction,
  guideSpotlightCandidates,
  isInternalGuideHref,
  spotlightInstructionIsFresh,
} from "@/lib/guide-show-me";

describe("FHF Guide Show Me helpers", () => {
  it("accepts only app-internal guide links", () => {
    expect(isInternalGuideHref("/housing-search?project=123")).toBe(true);
    expect(isInternalGuideHref("/projects/123/placement")).toBe(true);
    expect(isInternalGuideHref("https://example.com")).toBe(false);
    expect(isInternalGuideHref("//example.com/path")).toBe(false);
    expect(isInternalGuideHref(null)).toBe(false);
  });

  it("prefers targeted workflow areas before the main-content fallback", () => {
    expect(guideSpotlightCandidates("/housing-search?project=123")[0]).toContain("housing-search");
    expect(guideSpotlightCandidates("/projects/new")[0]).toContain("new-placement");
    expect(guideSpotlightCandidates("/projects/123/placement")[0]).toContain("placement");
    expect(guideSpotlightCandidates("/help")[0]).toContain("help-search");
    expect(guideSpotlightCandidates("/help")).toContain("#main-content");
  });

  it("builds a compact pending instruction with a safe fallback label", () => {
    expect(buildGuideSpotlightInstruction("/tasks", "  Review tasks  ", 1_000)).toEqual({
      href: "/tasks",
      label: "Review tasks",
      createdAt: 1_000,
    });
    expect(buildGuideSpotlightInstruction("/tasks", "   ", 1_000).label).toBe("Continue here");
  });

  it("expires old spotlight instructions instead of replaying them later", () => {
    const instruction = buildGuideSpotlightInstruction("/people", "Open People", 10_000);
    expect(spotlightInstructionIsFresh(instruction, 25_000)).toBe(true);
    expect(spotlightInstructionIsFresh(instruction, 40_001)).toBe(false);
    expect(spotlightInstructionIsFresh(instruction, 9_999)).toBe(false);
  });
});
