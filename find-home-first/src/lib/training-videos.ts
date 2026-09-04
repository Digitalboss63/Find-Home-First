import type { HelpTopic } from "@/lib/help-knowledge";

export interface TrainingVideoCatalog {
  available: HelpTopic[];
  planned: HelpTopic[];
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
