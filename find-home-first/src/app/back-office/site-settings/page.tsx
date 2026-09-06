import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformOwner } from "@/lib/auth";
import { getPlatformSetting } from "@/lib/repository";
import LogoManagerClient from "./logo/LogoManagerClient";

export const metadata: Metadata = { title: "Back Office — Site Settings" };

export default async function SiteSettingsPage() {
  await requirePlatformOwner();
  const setting = await getPlatformSetting("site_logo").catch(() => null);
  const currentLogoSrc = setting?.enabled && setting.value ? setting.value : null;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 lg:px-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-primary)" }}>
          Site Settings
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-text)", opacity: 0.6 }}>
          Platform-level configuration.
        </p>
      </div>

      {/* ── Logo Upload ─────────────────────────────────────────── */}
      <div className="mb-8 rounded-xl p-6" style={{ backgroundColor: "#fff", border: "1px solid var(--color-border)" }}>
        <h2 className="text-base font-semibold mb-1" style={{ color: "var(--color-primary)" }}>
          Site Logo
        </h2>
        <p className="text-xs mb-5" style={{ color: "var(--color-text)", opacity: 0.55 }}>
          Upload a custom logo (PNG, JPEG, SVG, WebP — max 2 MB). Restoring default returns to the built-in FHF logo.
        </p>
        <LogoManagerClient currentLogoSrc={currentLogoSrc} />
      </div>

      {/* ── Other settings ──────────────────────────────────────── */}
      <ul className="space-y-2">
        <li>
          <Link
            href="/back-office/site-settings/training-videos"
            className="flex items-center justify-between rounded-xl px-5 py-4 text-sm font-semibold"
            style={{ backgroundColor: "#fff", border: "1px solid var(--color-border)", color: "var(--color-primary)" }}
          >
            Training Videos
            <span aria-hidden="true" style={{ color: "var(--color-secondary)" }}>→</span>
          </Link>
        </li>
        <li>
          <Link
            href="/back-office/site-settings/integrations"
            className="flex items-center justify-between rounded-xl px-5 py-4 text-sm font-semibold"
            style={{ backgroundColor: "#fff", border: "1px solid var(--color-border)", color: "var(--color-primary)" }}
          >
            Integrations
            <span aria-hidden="true" style={{ color: "var(--color-secondary)" }}>→</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
