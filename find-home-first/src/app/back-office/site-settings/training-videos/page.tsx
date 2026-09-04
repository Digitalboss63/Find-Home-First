import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformOwner } from "@/lib/auth";
import { getTrainingVideoMap } from "@/lib/training-video-settings";
import TrainingVideoManager from "./TrainingVideoManager";

export const metadata: Metadata = { title: "Back Office — Training Videos" };
export const dynamic = "force-dynamic";

export default async function TrainingVideosSettingsPage() {
  await requirePlatformOwner();
  const initialVideos = await getTrainingVideoMap();

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 lg:px-10">
      <div className="mb-8">
        <p className="text-xs text-slate-500">
          <Link href="/back-office/site-settings" className="font-semibold hover:underline">Site Settings</Link> / Training Videos
        </p>
        <h1 className="mt-2 text-2xl font-bold" style={{ color: "var(--color-primary)" }}>
          Training Video Manager
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Paste the training video link for each Find Home First help topic. Save once and the link becomes available in the Help Center, Training Videos library, and FHF Guide.
        </p>
      </div>

      <TrainingVideoManager initialVideos={initialVideos} />
    </div>
  );
}
