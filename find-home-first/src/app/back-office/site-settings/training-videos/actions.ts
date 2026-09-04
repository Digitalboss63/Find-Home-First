"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformOwner } from "@/lib/auth";
import { HELP_TOPICS } from "@/lib/help-knowledge";
import { upsertPlatformSetting, writeAuditLog } from "@/lib/repository";
import {
  normalizeTrainingVideoUrl,
  TRAINING_VIDEO_SETTING_KEY,
} from "@/lib/training-video-settings";
import type { TrainingVideoMap } from "@/lib/training-videos";

export interface SaveTrainingVideosResult {
  ok: boolean;
  count?: number;
  error?: string;
}

export async function saveTrainingVideosAction(
  values: Record<string, string>
): Promise<SaveTrainingVideosResult> {
  const { clerkUserId } = await requirePlatformOwner();

  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return { ok: false, error: "Invalid training video data." };
  }

  const cleaned: TrainingVideoMap = {};

  // Only canonical help-topic IDs are persisted. Unknown input keys are ignored.
  for (const topic of HELP_TOPICS) {
    const rawValue = values[topic.id];
    if (typeof rawValue !== "string" || !rawValue.trim()) continue;

    const normalized = normalizeTrainingVideoUrl(rawValue);
    if (!normalized) {
      return {
        ok: false,
        error: `Enter a valid http or https video URL for “${topic.title}”.`,
      };
    }

    cleaned[topic.id] = normalized;
  }

  const ok = await upsertPlatformSetting(
    TRAINING_VIDEO_SETTING_KEY,
    JSON.stringify(cleaned),
    true,
    clerkUserId
  );

  if (!ok) {
    return { ok: false, error: "Could not save training video links." };
  }

  await writeAuditLog({
    actorClerkUserId: clerkUserId,
    eventType: "training_videos.updated",
    detail: `${Object.keys(cleaned).length} training video link(s) published.`,
  });

  revalidatePath("/help");
  revalidatePath("/help/videos");
  revalidatePath("/back-office/site-settings/training-videos");

  return { ok: true, count: Object.keys(cleaned).length };
}
