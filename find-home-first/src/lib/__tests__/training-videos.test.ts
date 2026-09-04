import { describe, expect, it } from "vitest";
import { getTrainingVideoCatalog } from "@/lib/training-videos";
import type { HelpTopic } from "@/lib/help-knowledge";

function topic(id: string, videoUrl?: string): HelpTopic {
  return {
    id,
    category: "Getting Started",
    title: id,
    shortDescription: "Description",
    whyItMatters: "Why",
    whenToUse: "When",
    steps: ["Step"],
    nextAction: "Next",
    keywords: [],
    contexts: [],
    ...(videoUrl === undefined ? {} : { videoUrl }),
  };
}

describe("training video catalog", () => {
  it("uses the help topic videoUrl as the single published/planned signal", () => {
    const catalog = getTrainingVideoCatalog([
      topic("published", "https://video.example/published"),
      topic("planned"),
      topic("blank", "   "),
    ]);

    expect(catalog.available.map((item) => item.id)).toEqual(["published"]);
    expect(catalog.planned.map((item) => item.id)).toEqual(["planned", "blank"]);
  });

  it("preserves knowledge repository order for the recording checklist", () => {
    const catalog = getTrainingVideoCatalog([
      topic("one"),
      topic("two", "https://video.example/two"),
      topic("three"),
    ]);

    expect(catalog.planned.map((item) => item.id)).toEqual(["one", "three"]);
    expect(catalog.available.map((item) => item.id)).toEqual(["two"]);
  });
});
