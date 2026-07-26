/**
 * Back Office — Integrations server actions.
 *
 * SECURITY: requirePlatformOwner() is the first call in every action.
 * Organization owners and staff cannot reach these actions.
 * Embed code is stored in DB only — never logged or returned to client as-is
 * (it is read back via the page server component for display only in the editor).
 */
"use server";

import { requirePlatformOwner } from "@/lib/auth";
import { upsertPlatformSetting, writeAuditLog } from "@/lib/repository";

export interface SaveAdaWidgetResult {
  ok: boolean;
  error?: string;
}

/**
 * Saves the ADA widget embed code and enable/disable toggle.
 * Records the action in the audit log.
 */
export async function saveAdaWidgetAction(
  embedCode: string,
  enabled: boolean
): Promise<SaveAdaWidgetResult> {
  const { clerkUserId } = await requirePlatformOwner();

  // Validate — embedCode may be empty (clearing it)
  if (typeof embedCode !== "string") {
    return { ok: false, error: "Invalid embed code." };
  }

  const trimmed = embedCode.trim();
  const ok = await upsertPlatformSetting(
    "ada_widget",
    trimmed || null,
    enabled,
    clerkUserId
  );

  if (ok) {
    const eventType = !trimmed
      ? "ada_widget.removed"
      : enabled
      ? "ada_widget.enabled"
      : "ada_widget.disabled";

    await writeAuditLog({
      actorClerkUserId: clerkUserId,
      eventType,
      detail: enabled && trimmed ? "ADA widget embed code updated." : undefined,
    });
  }

  return { ok, error: ok ? undefined : "Could not save ADA widget settings." };
}
