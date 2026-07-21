import type { Metadata } from "next";
import AccessibilityReportForm from "./AccessibilityReportForm";

export const metadata: Metadata = {
  title: "Report an Accessibility Issue",
  description:
    "Use this form to report an accessibility barrier on Find Home First. We aim to respond within 5 business days.",
};

export default function AccessibilityReportPage() {
  return (
    <div className="flex flex-col flex-1 bg-[--brand-surface] dark:bg-[--background]">
      <div className="mx-auto max-w-2xl w-full px-6 py-16">
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50 mb-3">
            Report an Accessibility Issue
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            Encountered a barrier on Find Home First? Please describe the issue
            below. We review all reports and aim to respond within{" "}
            <strong>5 business days</strong>.
          </p>
        </header>

        <AccessibilityReportForm />
      </div>
    </div>
  );
}
