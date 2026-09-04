import type { Metadata } from "next";
import TrainingVideoLibrary from "@/components/TrainingVideoLibrary";

export const metadata: Metadata = {
  title: "Training Videos",
  description: "Find Home First task-focused training videos and recording checklist.",
};

export const dynamic = "force-dynamic";

export default function TrainingVideosPage() {
  return <TrainingVideoLibrary />;
}
