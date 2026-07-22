/**
 * / — Home workspace
 *
 * The guided starting point for each session.
 * One primary action, blocker alert (conditional), journey summary,
 * active projects, and today's tasks.
 *
 * Data source: PostgreSQL via repository when DATABASE_URL is set,
 * otherwise falls back to src/demo/data.ts.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { DEMO_PROJECTS, DEMO_TASKS } from "@/demo/data";
import { listActiveProjects, listTasks } from "@/lib/repository";
import { getStageLabelForKey } from "@/lib/stages";
import StageJourney from "@/components/StageJourney";
import BlockerAlert from "@/components/BlockerAlert";
import DemoNotice from "@/components/DemoNotice";

export const metadata: Metadata = {
  title: "Home",
  description: "Your guided housing placement workspace.",
};

// ── Demo adapters ──────────────────────────────────────────────────────────────

function demoProjectsAsViews() {
  return DEMO_PROJECTS.map((p) => ({
    id: p.id,
    name: p.name,
    community: p.community,
    currentStage: p.currentStage as string,
    blocker: p.blocker ?? null,
    residentName: p.residentName,
    groupStatus:
      p.status === "completed"
        ? ("completed" as const)
        : ("active" as const),
  }));
}

function demoTasksAsViews() {
  return DEMO_TASKS.map((t) => ({
    id: t.id,
    title: t.title,
    projectName: t.projectName,
    status: t.status,
  }));
}

export default async function HomePage() {
  // ── Fetch data — fall back to demo on failure ──────────────────────────────
  const dbActiveProjects = await listActiveProjects();
  const dbTasks = await listTasks();

  const usingDemo = dbActiveProjects === null || dbTasks === null;

  const activeProjects = usingDemo
    ? demoProjectsAsViews().filter((p) => p.groupStatus === "active")
    : dbActiveProjects.map((p) => ({
        id: p.id,
        name: p.name,
        community: p.community,
        currentStage: p.currentStage,
        blocker: p.blocker,
        residentName: p.residentName,
        groupStatus: p.groupStatus,
      }));

  const allTasks = usingDemo
    ? demoTasksAsViews()
    : (dbTasks ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        projectName: t.projectName,
        status: t.status,
      }));

  const blockedProject = activeProjects.find((p) => p.blocker);
  const primaryProject = blockedProject ?? activeProjects[0];
  const todayTasks = allTasks.filter((t) => t.status === "today");

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 lg:px-10">
      {usingDemo && <DemoNotice />}

      {/* ── Primary action ──────────────────────────────────────────── */}
      <section aria-labelledby="primary-action-heading" className="mb-10">
        <div
          className="rounded-xl px-6 py-6"
          style={{ backgroundColor: "var(--color-highlight)" }}
        >
          <p
            className="text-xs font-semibold tracking-widest uppercase mb-2"
            style={{ color: "var(--color-primary)", opacity: 0.7 }}
          >
            Your next action
          </p>
          <h1
            id="primary-action-heading"
            className="text-2xl font-bold leading-snug mb-4"
            style={{ color: "var(--color-primary)" }}
          >
            {primaryProject?.blocker
              ? primaryProject.name
              : primaryProject
              ? `Continue: ${primaryProject.name}`
              : "No active projects"}
          </h1>

          {primaryProject?.blocker && (
            <div className="mb-5">
              <BlockerAlert blocker={primaryProject.blocker} />
            </div>
          )}

          {primaryProject && (
            <Link
              href={`/projects/${primaryProject.id}`}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white"
              style={{ backgroundColor: "var(--color-action)" }}
            >
              Open project
              <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      </section>

      {/* ── Placement journey ───────────────────────────────────────── */}
      {primaryProject && (
        <section aria-labelledby="journey-heading" className="mb-10">
          <div className="flex items-baseline justify-between mb-4">
            <h2
              id="journey-heading"
              className="text-base font-semibold"
              style={{ color: "var(--color-primary)" }}
            >
              Placement Journey
            </h2>
            <span
              className="text-xs"
              style={{ color: "var(--color-text)", opacity: 0.55 }}
            >
              {primaryProject.name}
            </span>
          </div>
          <div
            className="rounded-xl px-6 py-6"
            style={{
              backgroundColor: "var(--color-surface-soft)",
              border: "1px solid var(--color-border)",
            }}
          >
            <StageJourney
              currentStage={
                primaryProject.currentStage as Parameters<
                  typeof StageJourney
                >[0]["currentStage"]
              }
            />
          </div>
        </section>
      )}

      {/* ── Active projects ─────────────────────────────────────────── */}
      <section aria-labelledby="active-projects-heading" className="mb-10">
        <div className="flex items-baseline justify-between mb-4">
          <h2
            id="active-projects-heading"
            className="text-base font-semibold"
            style={{ color: "var(--color-primary)" }}
          >
            Active Projects
          </h2>
          <Link
            href="/projects"
            className="text-xs font-medium"
            style={{ color: "var(--color-secondary)" }}
          >
            View all projects →
          </Link>
        </div>

        {activeProjects.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-text)", opacity: 0.6 }}>
            No active projects.
          </p>
        ) : (
          <ul className="space-y-2">
            {activeProjects.slice(0, 5).map((project) => (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="project-link flex items-start justify-between gap-4 rounded-lg px-4 py-3.5 group"
                  style={{
                    backgroundColor: "var(--color-surface-soft)",
                    border: "1px solid var(--color-border)",
                    display: "flex",
                  }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="font-semibold text-sm leading-snug group-hover:underline"
                        style={{ color: "var(--color-primary)" }}
                      >
                        {project.name}
                      </span>
                      {project.blocker && (
                        <span
                          aria-label="Has blocker"
                          className="text-xs px-1.5 py-0.5 rounded font-medium"
                          style={{
                            backgroundColor: "#FEF3C7",
                            color: "var(--color-action)",
                          }}
                        >
                          ⚠ Blocked
                        </span>
                      )}
                    </div>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: "var(--color-text)", opacity: 0.65 }}
                    >
                      {project.residentName} · {project.community}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className="text-xs font-medium px-2 py-1 rounded-full"
                      style={{
                        backgroundColor: "#fff",
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
        )}
      </section>

      {/* ── Today's tasks ───────────────────────────────────────────── */}
      <section aria-labelledby="today-tasks-heading">
        <div className="flex items-baseline justify-between mb-4">
          <h2
            id="today-tasks-heading"
            className="text-base font-semibold"
            style={{ color: "var(--color-primary)" }}
          >
            Today&rsquo;s Tasks
          </h2>
          <Link
            href="/tasks"
            className="text-xs font-medium"
            style={{ color: "var(--color-secondary)" }}
          >
            All tasks →
          </Link>
        </div>

        {todayTasks.length === 0 ? (
          <p
            className="text-sm"
            style={{ color: "var(--color-text)", opacity: 0.6 }}
          >
            No tasks due today.
          </p>
        ) : (
          <ul className="space-y-2">
            {todayTasks.map((task) => (
              <li
                key={task.id}
                className="flex items-start gap-3 rounded-lg px-4 py-3.5"
                style={{
                  backgroundColor: "var(--color-surface-soft)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <span
                  className="shrink-0 mt-0.5 text-xs font-semibold"
                  style={{ color: "var(--color-action)" }}
                  aria-label="Today"
                >
                  ● Today
                </span>
                <div className="min-w-0">
                  <p
                    className="text-sm font-medium leading-snug"
                    style={{ color: "var(--color-text)" }}
                  >
                    {task.title}
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: "var(--color-text)", opacity: 0.55 }}
                  >
                    {task.projectName}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
