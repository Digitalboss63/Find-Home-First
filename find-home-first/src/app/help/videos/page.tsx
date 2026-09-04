import type { Metadata } from "next";
import TrainingVideoLibrary from "@/components/TrainingVideoLibrary";

export const metadata: Metadata = {
  title: "Training Videos",
  description: "Find Home First task-focused training videos and recording checklist.",
};

export default function TrainingVideosPage() {
  return <TrainingVideoLibrary />;
}
