/**
 * ProjectSelector — shown on /housing-search when no projectId is in the URL.
 * Server or client component (no hooks needed — pure link rendering).
 */
import Link from "next/link";
import type { ProjectView } from "@/lib/repository";

const PROPERTY_SEARCH_ELIGIBLE_STATUSES = new Set([
  "city_approved",
  "finding_property",
  "contacting_owner",
  "application_in_progress",
  "property_approved",
  "preparing_property",
  "seeking_referrals",
  "reviewing_resident",
  "placement_approved",
]);

export function getProjectNextStep(project: ProjectView): {
  href: string;
  label: string;
  helper: string;
  isReady: boolean;
} {
  const isReady = PROPERTY_SEARCH_ELIGIBLE_STATUSES.has(project.currentStatus);

  return isReady
    ? {
        href: `/housing-search?project=${project.id}`,
        label: "Find Properties",
        helper: "Ready for property search",
        isReady: true,
      }
    : {
        href: `/projects/${project.id}/research`,
        label: "View City Report",
        helper: "Complete the City Report first",
        isReady: false,
      };
}

interface Props {
  projects: ProjectView[];
}

export default function ProjectSelector({ projects }: Props) {
  if (projects.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8 lg:px-10">
        <h1
          className="text-2xl font-bold mb-2"
          style={{ color: "var(--color-primary)" }}
        >
          Find Properties &amp; Owners
        </h1>
        <p
          className="text-sm mb-8"
          style={{ color: "var(--color-text)", opacity: 0.6 }}
        >
          Select a placement project to search properties for.
        </p>

        <div
          className="rounded-xl px-6 py-10 text-center"
          style={{
            backgroundColor: "var(--color-surface-soft)",
            border: "1px solid var(--color-border)",
          }}
        >
          <p
            className="text-sm mb-4"
            style={{ color: "var(--color-text)", opacity: 0.65 }}
          >
            No active projects yet. Create a new placement project to get started.
          </p>
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white"
            style={{ backgroundColor: "var(--color-action)" }}
          >
            Start New Placement
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 lg:px-10">
      <h1
        className="text-2xl font-bold mb-2"
        style={{ color: "var(--color-primary)" }}
      >
        Find Properties &amp; Owners
      </h1>
      <p
        className="text-sm mb-8"
        style={{ color: "var(--color-text)", opacity: 0.6 }}
      >
        Choose a project. We&apos;ll take you to the correct next step.
      </p>

      <ul className="space-y-2 mb-6">
        {projects.map((project) => {
          const nextStep = getProjectNextStep(project);

          return (
            <li key={project.id}>
              <Link
                href={nextStep.href}
                aria-label={`${nextStep.label} for ${project.name}`}
                className="group flex flex-col items-stretch justify-between gap-4 rounded-xl px-5 py-5 sm:flex-row sm:items-center sm:gap-5"
                style={{
                  backgroundColor: "#fff",
                  border: "1px solid var(--color-border)",
                }}
              >
                <div className="min-w-0">
                  <p
                    className="font-semibold text-sm group-hover:underline"
                    style={{ color: "var(--color-primary)" }}
                  >
                    {project.name}
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: "var(--color-text)", opacity: 0.6 }}
                  >
                    {project.community}
                  </p>
                  <p
                    className="text-xs mt-2 font-medium"
                    style={{
                      color: nextStep.isReady
                        ? "#166534"
                        : "var(--color-text)",
                      opacity: nextStep.isReady ? 1 : 0.65,
                    }}
                  >
                    {nextStep.helper}
                  </p>
                </div>
                <span
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold"
                  style={{
                    backgroundColor: nextStep.isReady
                      ? "var(--color-action)"
                      : "var(--color-primary)",
                    color: "#fff",
                  }}
                >
                  {nextStep.label}
                  <span aria-hidden="true">→</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <Link
        href="/projects/new"
        className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold"
        style={{
          border: "1px solid var(--color-border)",
          color: "var(--color-primary)",
          backgroundColor: "#fff",
        }}
      >
        Start New Placement
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
