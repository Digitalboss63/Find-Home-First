import { describe, expect, it } from "vitest";
import {
  buildAiSafeGuideContext,
  buildGuideAiInput,
  buildWorkflowFallbackAnswer,
  extractOpenAiResponseText,
} from "@/lib/guide-ai";
import type { GuideProjectContext } from "@/lib/project-guidance";
import type { HelpTopic } from "@/lib/help-knowledge";

function contextFixture(): GuideProjectContext {
  return {
    project: {
      id: "project-secret-id",
      name: "Private Veteran Placement",
      community: "Atlanta",
      currentStatus: "finding_property",
      currentStage: "find-housing",
      targetMoveIn: null,
      blocker: null,
      blockerReason: null,
      nextAction: null,
      residentName: "Sensitive Resident Name",
    },
    stageLabel: "Find Housing",
    blocker: null,
    nextAction: {
      label: "Find Properties",
      href: "/housing-search?project=project-secret-id",
      reason: "The market is ready for property sourcing and qualification.",
    },
    missingItems: ["Saved property candidate"],
    openTasks: [
      {
        id: "task-1",
        title: "Call Resident Jane Doe",
        dueDate: null,
        status: "today",
      },
    ],
    savedPropertyCount: 0,
    summary: "Private Veteran Placement is in Find Housing for Atlanta.",
  };
}

const topicFixture: HelpTopic = {
  id: "property-search",
  category: "Properties",
  title: "Find Properties",
  shortDescription: "Search for property candidates in the approved target market.",
  whyItMatters: "A saved property candidate is required before owner outreach can advance.",
  whenToUse: "After market research is approved.",
  steps: ["Open Find Properties.", "Review candidates.", "Save the strongest lead."],
  requiredInfo: [],
  commonMistakes: [],
  nextAction: "Save a qualified property candidate.",
  relatedTopicIds: [],
  route: "/housing-search",
  routeLabel: "Open Find Properties",
  videoUrl: null,
  keywords: ["property", "search"],
};

describe("FHF Guide AI helpers", () => {
  it("minimizes project context before it can reach an external model", () => {
    const safe = buildAiSafeGuideContext(contextFixture());
    const serialized = JSON.stringify(safe);

    expect(serialized).not.toContain("Private Veteran Placement");
    expect(serialized).not.toContain("Sensitive Resident Name");
    expect(serialized).not.toContain("Call Resident Jane Doe");
    expect(serialized).not.toContain("Atlanta");
    expect(serialized).toContain("finding_property");
    expect(serialized).toContain("Saved property candidate");
    expect(serialized).toContain("Find Properties");
  });

  it("builds a prompt from privacy-minimized context and generic help content", () => {
    const input = buildGuideAiInput(
      "I found a house. What should I do with it?",
      contextFixture(),
      [topicFixture]
    );

    expect(input).toContain("I found a house. What should I do with it?");
    expect(input).toContain("Find Housing");
    expect(input).toContain("Find Properties");
    expect(input).not.toContain("Sensitive Resident Name");
    expect(input).not.toContain("Call Resident Jane Doe");
    expect(input).not.toContain("Private Veteran Placement");
  });

  it("provides useful workflow guidance when no external AI key is configured", () => {
    const answer = buildWorkflowFallbackAnswer(contextFixture(), [topicFixture]);
    expect(answer).toContain("Saved property candidate");
    expect(answer).toContain("Find Properties");
  });

  it("extracts output text from a Responses API payload", () => {
    const answer = extractOpenAiResponseText({
      output: [
        {
          type: "message",
          content: [
            { type: "output_text", text: "Use Find Properties and save the strongest candidate." },
          ],
        },
      ],
    });

    expect(answer).toBe("Use Find Properties and save the strongest candidate.");
  });
});
