"use server";
import { requirePlatformOwner } from "@/lib/auth";
import { upsertPlatformSetting, writeAuditLog } from "@/lib/repository";

export interface LogoActionResult {
  ok: boolean;
  error?: string;
}

export async function restoreDefaultLogoAction(): Promise<LogoActionResult> {
  const { clerkUserId } = await requirePlatformOwner();
  const ok = await upsertPlatformSetting("site_logo", null, false, clerkUserId);
  if (ok) {
    await writeAuditLog({
      actorClerkUserId: clerkUserId,
      eventType: "site_logo.restored_default",
      detail: "Site logo restored to default.",
    });
  }
  return { ok, error: ok ? undefined : "Could not restore default logo." };
}
