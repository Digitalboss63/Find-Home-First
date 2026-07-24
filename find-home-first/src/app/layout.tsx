import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import SkipLink from "@/components/SkipLink";
import AppShell from "@/components/AppShell";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen">
        <ClerkProvider>
          <SkipLink />
          <AppShell>{children}</AppShell>
        </ClerkProvider>
      </body>
    </html>
  );
}
