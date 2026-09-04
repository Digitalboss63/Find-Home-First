import type { Metadata } from "next";
import Link from "next/link";
import HelpCenter from "@/components/HelpCenter";
import { getTrainingVideoMap } from "@/lib/training-video-settings";

export const metadata: Metadata = {
  title: "Help Center",
  description: "Find Home First feature guidance, instructions, workflow help, and training videos.",
};

export const dynamic = "force-dynamic";

export default async function HelpPage() {
  const videoUrls = await getTrainingVideoMap();

  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-5 pt-7 sm:px-6 lg:px-8 lg:pt-9">
        <Link
          href="/help/videos"
          className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold shadow-sm hover:bg-slate-50"
          style={{ color: "var(--color-primary)" }}
        >
          Training Videos →
        </Link>
      </div>
      <HelpCenter videoUrls={videoUrls} />
    </>
  );
}
