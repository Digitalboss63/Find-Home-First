import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Accessibility Statement",
  description:
    "Find Home First is committed to digital accessibility for all users, including people with disabilities.",
};

export default function AccessibilityPage() {
  return (
    <div className="flex flex-col flex-1 bg-[--brand-surface] dark:bg-[--background]">
      <div className="mx-auto max-w-2xl w-full px-6 py-16">
        <article aria-labelledby="accessibility-heading">
          <header className="mb-10">
            <h1
              id="accessibility-heading"
              className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50 mb-3"
            >
              Accessibility Statement
            </h1>
            <p className="text-sm text-[--brand-muted]">
              Last reviewed: July 2026
            </p>
          </header>

          <div className="prose prose-gray dark:prose-invert max-w-none text-sm leading-relaxed space-y-6 text-gray-700 dark:text-gray-300">
            <section aria-labelledby="commitment-heading">
              <h2
                id="commitment-heading"
                className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-8 mb-2"
              >
                Our Commitment
              </h2>
              <p>
                Find Home First is committed to ensuring digital accessibility
                for people with disabilities. We continually improve the user
                experience for everyone and apply relevant accessibility
                standards throughout the platform.
              </p>
            </section>

            <section aria-labelledby="standards-heading">
              <h2
                id="standards-heading"
                className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-8 mb-2"
              >
                Standards
              </h2>
              <p>
                We aim to meet{" "}
                <strong>
                  Web Content Accessibility Guidelines (WCAG) 2.1 Level AA
                </strong>
                . These guidelines explain how to make web content more
                accessible to people with disabilities and more user-friendly
                for everyone.
              </p>
            </section>

            <section aria-labelledby="measures-heading">
              <h2
                id="measures-heading"
                className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-8 mb-2"
              >
                Measures We Take
              </h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Semantic HTML landmarks (header, nav, main, footer)</li>
                <li>Skip-to-main-content link for keyboard navigation</li>
                <li>
                  Visible focus indicators on all interactive elements
                </li>
                <li>Screen-reader–compatible text alternatives</li>
                <li>Respects prefers-reduced-motion system preference</li>
                <li>
                  Sufficient color contrast ratios for text and UI elements
                </li>
                <li>Responsive layout that works at 320&thinsp;px and above</li>
              </ul>
            </section>

            <section aria-labelledby="known-limitations-heading">
              <h2
                id="known-limitations-heading"
                className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-8 mb-2"
              >
                Known Limitations
              </h2>
              <p>
                Find Home First is currently in early development. Some features
                are not yet built, and accessibility review will continue as the
                platform expands. We document and prioritize known gaps.
              </p>
            </section>

            <section aria-labelledby="feedback-heading">
              <h2
                id="feedback-heading"
                className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-8 mb-2"
              >
                Feedback and Contact
              </h2>
              <p>
                We welcome feedback on the accessibility of Find Home First. If
                you experience barriers, please{" "}
                <Link
                  href="/accessibility-report"
                  className="text-[--brand-accent] underline hover:no-underline"
                >
                  report an accessibility issue
                </Link>
                . We aim to respond to feedback within 5 business days.
              </p>
            </section>

            <section aria-labelledby="enforcement-heading">
              <h2
                id="enforcement-heading"
                className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-8 mb-2"
              >
                Enforcement Procedure
              </h2>
              <p>
                If you are not satisfied with our response to your accessibility
                report, you may contact the{" "}
                <a
                  href="https://www.ada.gov/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[--brand-accent] underline hover:no-underline"
                >
                  U.S. Department of Justice ADA Information Line
                </a>{" "}
                or an equivalent body in your jurisdiction.
              </p>
            </section>
          </div>
        </article>
      </div>
    </div>
  );
}
