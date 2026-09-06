import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import SkipLink from "@/components/SkipLink";
import AppShell from "@/components/AppShell";
import AdaWidgetInjector from "@/components/AdaWidgetInjector";
import RouteBackButton from "@/components/RouteBackButton";
import { getPlatformSetting } from "@/lib/repository";
import { isPlatformOwner } from "@/lib/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Find Home First",
    template: "%s | Find Home First",
  },
  description:
    "A guided workspace for housing professionals to research communities, locate housing, secure properties, match residents, and manage placement through confirmed move-in.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // ── ADA widget + logo ────────────────────────────────────────────────────────
  // Read once per request at the root layout.
  // Only the platform owner can enable/change these via Back Office.
  const [adaSetting, platformOwner, logoSetting] = await Promise.all([
    getPlatformSetting("ada_widget").catch(() => null),
    isPlatformOwner(),
    getPlatformSetting("site_logo").catch(() => null),
  ]);
  const adaCode =
    adaSetting?.enabled && adaSetting.value ? adaSetting.value.trim() : null;
  // Always pass a logo URL to AppShell. Custom uploads are served through
  // /api/site-logo; otherwise the approved built-in FHF logo is shown.
  const logoSrc =
    logoSetting?.enabled && logoSetting.value
      ? "/api/site-logo"
      : "/images/fhf-logo.svg";
  const production = process.env.NODE_ENV === "production";

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen">
        {production && (
          <style>{`footer[role="contentinfo"] { display: none !important; }`}</style>
        )}
        <ClerkProvider>
          <SkipLink />
          <AppShell showBackOffice={platformOwner} logoSrc={logoSrc}>
            <Suspense fallback={null}>
              <RouteBackButton />
            </Suspense>
            {children}
          </AppShell>
          {/* ADA widget — renders only when platform owner has enabled it. */}
          {adaCode && <AdaWidgetInjector code={adaCode} />}
        </ClerkProvider>
      </body>
    </html>
  );
}
