import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { upsertPlatformSetting, writeAuditLog } from "@/lib/repository";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

export function isPlatformOwner(userId: string): boolean {
  const ownerId = process.env.PLATFORM_OWNER_CLERK_USER_ID;
  return !!ownerId && userId === ownerId;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId || !isPlatformOwner(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const formData = await req.formData();
  const file = formData.get("logo") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "File type not allowed. Use PNG, JPEG, SVG, or WebP." },
      { status: 400 }
    );
  }
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "File too large. Maximum 2 MB." }, { status: 400 });
  }
  const base64 = Buffer.from(bytes).toString("base64");
  const dataUri = `data:${file.type};base64,${base64}`;
  const ok = await upsertPlatformSetting("site_logo", dataUri, true, userId);
  if (!ok) return NextResponse.json({ error: "Failed to save logo." }, { status: 500 });
  await writeAuditLog({
    actorClerkUserId: userId,
    eventType: "site_logo.updated",
    detail: `Logo updated: ${file.name} (${file.type}, ${bytes.byteLength} bytes)`,
  });
  return NextResponse.json({ ok: true, dataUri });
}

export async function DELETE(_req: NextRequest) {
  const { userId } = await auth();
  if (!userId || !isPlatformOwner(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ok = await upsertPlatformSetting("site_logo", null, false, userId);
  if (!ok) return NextResponse.json({ error: "Failed to restore default." }, { status: 500 });
  await writeAuditLog({
    actorClerkUserId: userId,
    eventType: "site_logo.restored_default",
    detail: "Site logo restored to default.",
  });
  return NextResponse.json({ ok: true });
}
