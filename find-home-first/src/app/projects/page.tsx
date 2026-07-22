/**
 * /projects — All housing placement projects, grouped by status.
 * Primary action (New Project) deferred until auth exists.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { DEMO_PROJECTS, STAGES } from "@/demo/data";
import DemoNotice from "@/components/DemoNotice";

export const metadata: Metadata = {
  title: "Projects",
  description: "All housing placement projects.",
};

function getStageLabelForKey(key: string) {
  return STAGES.find((s) => s.key === key)?.label ?? key;
}

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, React.CSSProperties> = {
    active: { backgroundColor: "#DCFCE7", color: "#166534" },
    "on-hold": { backgroundColor: "#FEF9C3", color: "#854D0E" },
    completed: {
      backgroundColor: "var(--color-surface-soft)",
      color: "var(--color-secondary)",
    },
  };
  const labels: Record<string, string> = {
    active: "Active",
    "on-hold": "On Hold",
    completed: "Completed",
  };

  return (
    <span
      className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full"
      style={styles[status] ?? styles.active}
    >
      {labels[status] ?? status}
    </span>
  );
}

function ProjectRow({ project }: { project: (typeof DEMO_PROJECTS)[0] }) {
  return (
    <li>
      <Link
        href={`/projects/${project.id}`}
        className="group flex items-start gap-4 rounded-xl px-5 py-4 transition-colors"
        style={{
          backgroundColor: "#fff",
          border: "1px solid var(--color-border)",
        }}
      >
        {/* Left: name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span
              className="font-semibold text-sm group-hover:underline leading-snug"
              style={{ color: "var(--color-primary)" }}
            >
              {project.name}
            </span>
            {project.blocker && (
              <span
                className="text-xs px-1.5 py-0.5 rounded font-medium shrink-0"
                style={{ backgroundColor: "#FEF3C7", color: "var(--color-action)" }}
                aria-label="Project has a blocker"
              >
                ⚠ Blocked
              </span>
            )}
          </div>
          <div
            className="flex flex-wrap gap-x-4 gap-y-1 text-xs"
            style={{ color: "var(--color-text)", opacity: 0.65 }}
          >
            <span>{project.residentName}</span>
            <span>{project.community}</span>
            <span>
              Move-in:{" "}
              <time dateTime={project.targetMoveIn}>
                {formatDate(project.targetMoveIn)}
              </time>
            </span>
          </div>
          {project.blocker && (
            <p
              className="mt-2 text-xs rounded px-2 py-1.5 leading-snug"
              style={{
                backgroundColor: "#FEF3C7",
                color: "var(--color-action)",
              }}
            >
              {project.blocker}
            </p>
          )}
        </div>

        {/* Right: badges */}
        <div className="shrink-0 flex flex-col items-end gap-2">
          <StatusBadge status={project.status} />
          <span
            className="text-xs font-medium px-2 py-0.5 rounded"
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
  );
}

export default function ProjectsPage() {
  const active = DEMO_PROJECTS.filter((p) => p.status === "active");
  const onHold = DEMO_PROJECTS.filter((p) => p.status === "on-hold");
  const completed = DEMO_PROJECTS.filter((p) => p.status === "completed");

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 lg:px-10">
      {/* Page header */}
      <div className="mb-8">
        <DemoNotice />
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--color-primary)" }}
        >
          Projects
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--color-text)", opacity: 0.6 }}
        >
          {DEMO_PROJECTS.length} total — {active.length} active
        </p>
      </div>

      {/* ── Active ──────────────────────────────────────────────────── */}
      {active.length > 0 && (
        <section aria-labelledby="active-heading" className="mb-10">
          <h2
            id="active-heading"
            className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: "var(--color-text)", opacity: 0.75 }}
          >
            Active ({active.length})
          </h2>
          <ul className="space-y-2">
            {active.map((p) => (
              <ProjectRow key={p.id} project={p} />
            ))}
          </ul>
        </section>
      )}

      {/* ── On Hold ─────────────────────────────────────────────────── */}
      {onHold.length > 0 && (
        <section aria-labelledby="on-hold-heading" className="mb-10">
          <h2
            id="on-hold-heading"
            className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: "var(--color-text)", opacity: 0.75 }}
          >
            On Hold ({onHold.length})
          </h2>
          <ul className="space-y-2">
            {onHold.map((p) => (
              <ProjectRow key={p.id} project={p} />
            ))}
          </ul>
        </section>
      )}

      {/* ── Completed ───────────────────────────────────────────────── */}
      {completed.length > 0 && (
        <section aria-labelledby="completed-heading" className="mb-10">
          <h2
            id="completed-heading"
            className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: "var(--color-text)", opacity: 0.75 }}
          >
            Completed ({completed.length})
          </h2>
          <ul className="space-y-2">
            {completed.map((p) => (
              <ProjectRow key={p.id} project={p} />
            ))}
          </ul>
        </section>
      )}

      {DEMO_PROJECTS.length === 0 && (
        <p className="text-sm" style={{ color: "var(--color-text)", opacity: 0.6 }}>
          No projects yet.
        </p>
      )}
    </div>
  );
}
