import type { Metadata } from "next";
import { requirePlatformOwner } from "@/lib/auth";
import { getPlatformSetting } from "@/lib/repository";
import LogoManagerClient from "./LogoManagerClient";

export const metadata: Metadata = { title: "Back Office — Logo Manager" };

export default async function LogoManagerPage() {
  await requirePlatformOwner();
  const setting = await getPlatformSetting("site_logo").catch(() => null);
  const currentLogoSrc = setting?.enabled && setting.value ? setting.value : null;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 lg:px-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-primary)" }}>
          Logo Manager
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-text)", opacity: 0.6 }}>
          Upload a custom logo for the sidebar and mobile header. PNG, JPEG, SVG, or WebP — max 2 MB.
          Restoring default returns to the built-in FHF logo.
        </p>
      </div>
      <LogoManagerClient currentLogoSrc={currentLogoSrc} />
    </div>
  );
}
