"use client";

import { useEffect, useState } from "react";
import FhfGuideAI from "@/components/FhfGuideAI";
import GuideSpotlight from "@/components/GuideSpotlight";
import { HELP_TOPICS } from "@/lib/help-knowledge";
import type { TrainingVideoMap } from "@/lib/training-videos";

export default function FhfGuide() {
  const [videosReady, setVideosReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function hydrateVideos() {
      try {
        const response = await fetch("/api/training-videos", { cache: "no-store" });
        if (!response.ok) throw new Error(`Training video lookup failed with ${response.status}`);
        const payload = (await response.json()) as { videos?: TrainingVideoMap };
        const videos = payload.videos ?? {};

        for (const topic of HELP_TOPICS) {
          topic.videoUrl = videos[topic.id]?.trim() || undefined;
        }
      } catch (error) {
        console.warn(
          "[fhf-guide] training video links unavailable",
          error instanceof Error ? error.message : String(error)
        );
      } finally {
        if (!cancelled) setVideosReady(true);
      }
    }

    void hydrateVideos();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {videosReady && <FhfGuideAI />}
      <GuideSpotlight />
    </>
  );
}
