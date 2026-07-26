/**
 * ProjectSelector — shown on /housing-search when no projectId is in the URL.
 * Server or client component (no hooks needed — pure link rendering).
 */
import Link from "next/link";
import type { ProjectView } from "@/lib/repository";
import { getStageLabelForKey } from "@/lib/stages";

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
        Select a placement project to search properties for.
      </p>

      <ul className="space-y-2 mb-6">
        {projects.map((project) => (
          <li key={project.id}>
            <Link
              href={`/housing-search?project=${project.id}`}
              className="flex items-start justify-between gap-4 rounded-xl px-5 py-4 group"
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
              </div>
              <div className="shrink-0">
                <span
                  className="text-xs font-medium px-2 py-1 rounded-full"
                  style={{
                    backgroundColor: "var(--color-surface-soft)",
                    color: "var(--color-secondary)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  {getStageLabelForKey(project.currentStage)}
                </span>
              </div>
            </Link>
          </li>
        ))}
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
