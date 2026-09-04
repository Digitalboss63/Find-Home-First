import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { platformSettings } from "@/db/schema";
import type { TrainingVideoMap } from "@/lib/training-videos";

export const TRAINING_VIDEO_SETTING_KEY = "training_videos";

export function normalizeTrainingVideoUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function parseTrainingVideoMap(value: string | null | undefined): TrainingVideoMap {
  if (!value) return {};

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const result: TrainingVideoMap = {};
    for (const [topicId, rawUrl] of Object.entries(parsed)) {
      if (typeof rawUrl !== "string") continue;
      const url = normalizeTrainingVideoUrl(rawUrl);
      if (url) result[topicId] = url;
    }
    return result;
  } catch {
    return {};
  }
}

/**
 * Training links are platform-managed but intentionally readable by authenticated
 * application users through the training-videos API and server-rendered help pages.
 * No secret values are stored in this setting.
 */
export async function getTrainingVideoMap(): Promise<TrainingVideoMap> {
  const db = getDb();
  if (!db) return {};

  try {
    const rows = await db
      .select({
        value: platformSettings.value,
        enabled: platformSettings.enabled,
      })
      .from(platformSettings)
      .where(eq(platformSettings.settingKey, TRAINING_VIDEO_SETTING_KEY))
      .limit(1);

    if (rows.length === 0 || !rows[0].enabled) return {};
    return parseTrainingVideoMap(rows[0].value);
  } catch {
    console.warn("[training-videos] platform setting read failed");
    return {};
  }
}
