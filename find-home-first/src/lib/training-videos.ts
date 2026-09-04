import type { HelpTopic } from "@/lib/help-knowledge";

export type TrainingVideoMap = Record<string, string>;

export interface TrainingVideoCatalog {
  available: HelpTopic[];
  planned: HelpTopic[];
}

export function applyTrainingVideoUrls(
  topics: HelpTopic[],
  videos: TrainingVideoMap
): HelpTopic[] {
  return topics.map((topic) => ({
    ...topic,
    videoUrl: videos[topic.id]?.trim() || undefined,
  }));
}

export function getTrainingVideoCatalog(topics: HelpTopic[]): TrainingVideoCatalog {
  const available: HelpTopic[] = [];
  const planned: HelpTopic[] = [];

  for (const topic of topics) {
    if (topic.videoUrl?.trim()) {
      available.push(topic);
    } else {
      planned.push(topic);
    }
  }

  return { available, planned };
}
