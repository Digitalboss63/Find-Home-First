import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/auth";
import { getTrainingVideoMap } from "@/lib/training-video-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await requireOrganization();
  const videos = await getTrainingVideoMap();
  return NextResponse.json({ videos });
}
