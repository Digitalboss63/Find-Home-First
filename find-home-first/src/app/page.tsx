import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Find Home First",
  description:
    "A guided workspace for housing professionals — research communities, locate housing, secure properties, match residents, and confirm move-in.",
};

const steps = [
  {
    step: "01",
    label: "Research",
    description:
      "Explore community data, affordability indicators, and neighborhood fit to identify the right areas for placement.",
  },
  {
    step: "02",
    label: "Find Housing",
    description:
      "Locate suitable private housing units from verified sources and manual entries matched to resident needs.",
  },
  {
    step: "03",
    label: "Secure Property",
    description:
      "Coordinate outreach, documentation, and landlord agreements to hold and reserve units.",
  },
  {
    step: "04",
    label: "Match Resident",
    description:
      "Review resident profiles and align housing options based on eligibility, preferences, and program requirements.",
  },
  {
    step: "05",
    label: "Move In",
    description:
      "Confirm placement, capture move-in documentation, and close the case with a verified successful housing outcome.",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col flex-1 bg-[--brand-surface] dark:bg-[--background]">
      {/* Hero */}
      <section
        aria-labelledby="hero-heading"
        className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800"
      >
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-[--brand-accent] mb-4">
            Housing Placement Platform
          </p>
          <h1
            id="hero-heading"
            className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-50 sm:text-5xl leading-tight"
          >
            Guide Every Resident{" "}
            <span className="text-[--brand-primary] dark:text-blue-300">
              Home.
            </span>
          </h1>
          <p className="mt-6 text-lg text-gray-600 dark:text-gray-400 max-w-xl mx-auto leading-relaxed">
            Find Home First is a calm, guided workspace for housing
            professionals and organizations — from initial community research
            through confirmed move-in.
          </p>
          <p className="mt-4 text-sm text-[--brand-muted]">
            Platform launching soon &mdash; built for housing coordinators,
            case managers, and placement teams.
          </p>
        </div>
      </section>

      {/* Workflow */}
      <section
        aria-labelledby="workflow-heading"
        className="mx-auto max-w-3xl w-full px-6 py-16"
      >
        <h2
          id="workflow-heading"
          className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-10"
        >
          The Placement Workflow
        </h2>

        <ol className="flex flex-col gap-6 list-none m-0 p-0" role="list">
          {steps.map(({ step, label, description }) => (
            <li
              key={step}
              className="flex gap-5 items-start bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-6 py-5 shadow-sm"
            >
              <span
                aria-hidden="true"
                className="flex-shrink-0 w-10 h-10 rounded-full bg-[--brand-primary] text-white flex items-center justify-center text-sm font-bold"
              >
                {step}
              </span>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                  {label}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* For professionals callout */}
      <section
        aria-labelledby="for-professionals-heading"
        className="bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800"
      >
        <div className="mx-auto max-w-3xl px-6 py-14 text-center">
          <h2
            id="for-professionals-heading"
            className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3"
          >
            Built for Housing Professionals
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-lg mx-auto text-sm leading-relaxed">
            Designed for organizations doing the work — housing coordinators,
            case managers, rehousing specialists, and their teams. No consumer
            portal. No public listings. A focused tool for the people placing
            residents every day.
          </p>
        </div>
      </section>
    </div>
  );
}
