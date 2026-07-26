import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import SkipLink from "@/components/SkipLink";
import AppShell from "@/components/AppShell";
import AdaWidgetInjector from "@/components/AdaWidgetInjector";
import { getPlatformSetting } from "@/lib/repository";

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
  // ── ADA widget ───────────────────────────────────────────────────────────────
  // Read once per request at the root layout. Injected into <body> end via
  // AdaWidgetInjector when enabled and non-empty.
  // Only the platform owner can enable/change this via Back Office.
  const adaSetting = await getPlatformSetting("ada_widget").catch(() => null);
  const adaCode =
    adaSetting?.enabled && adaSetting.value ? adaSetting.value.trim() : null;

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen">
        <ClerkProvider>
          <SkipLink />
          <AppShell>{children}</AppShell>
          {/* ADA widget — renders only when platform owner has enabled it. */}
          {adaCode && <AdaWidgetInjector code={adaCode} />}
        </ClerkProvider>
      </body>
    </html>
  );
}
