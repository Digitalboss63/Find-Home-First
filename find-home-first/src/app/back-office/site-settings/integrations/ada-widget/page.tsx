/**
 * /back-office/site-settings/integrations/ada-widget
 * Canonical ADA widget management page.
 * Platform-owner only.
 */
import type { Metadata } from "next";
import { requirePlatformOwner } from "@/lib/auth";
import { getPlatformSetting } from "@/lib/repository";
import AdaWidgetEditor from "@/app/back-office/integrations/AdaWidgetEditor";

export const metadata: Metadata = { title: "Back Office — ADA Widget" };

export default async function AdaWidgetPage() {
  await requirePlatformOwner();
  const adaSetting = await getPlatformSetting("ada_widget");

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 lg:px-10">
      <div className="mb-8">
        <p className="text-xs mb-1" style={{ color: "var(--color-text)", opacity: 0.5 }}>
          Site Settings / Integrations /
        </p>
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-primary)" }}>
          ADA Widget
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-text)", opacity: 0.6 }}>
          Inject a third-party accessibility widget globally. When enabled and
          non-empty, the embed code is loaded once per page load. It does not
          execute inside this editor.
        </p>
      </div>

      <div
        className="rounded-xl p-6"
        style={{ backgroundColor: "#fff", border: "1px solid var(--color-border)" }}
      >
        <AdaWidgetEditor
          initialCode={adaSetting?.value ?? ""}
          initialEnabled={adaSetting?.enabled ?? false}
          lastUpdated={adaSetting?.updatedAt ?? null}
          lastUpdatedBy={adaSetting?.updatedByClerkUserId ?? null}
        />
      </div>
    </div>
  );
}
