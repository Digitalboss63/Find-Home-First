import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformOwner } from "@/lib/auth";

export const metadata: Metadata = { title: "Back Office — Site Settings" };

export default async function SiteSettingsPage() {
  await requirePlatformOwner();
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
