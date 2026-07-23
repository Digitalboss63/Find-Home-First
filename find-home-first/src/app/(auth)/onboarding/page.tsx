import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import OnboardingForm from "./OnboardingForm";

export const metadata: Metadata = { title: "Set Up Your Organization" };

export default async function OnboardingPage() {
  await requireUser();
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "var(--color-background)" }}>
      <div
        className="w-full max-w-md rounded-2xl px-8 py-10"
        style={{ backgroundColor: "#fff", border: "1px solid var(--color-border)" }}
      >
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--color-primary)" }}>
          Welcome to Find Home First
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--color-text)", opacity: 0.65 }}>
          Set up your organization to get started.
        </p>
        <OnboardingForm />
      </div>
    </div>
  );
}
