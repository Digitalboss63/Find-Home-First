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
import { redirect } from "next/navigation";
import { DEMO_PROJECTS, DEMO_TASKS } from "@/demo/data";
import {
  listActiveProjects,
  listTasks,
  isDemoAllowed,
} from "@/lib/repository";
import { requireOrganization } from "@/lib/auth";
import { getStageLabelForKey } from "@/lib/stages";
import StageJourney from "@/components/StageJourney";
import BlockerAlert from "@/components/BlockerAlert";
import DemoNotice from "@/components/DemoNotice";
import { canUsePlacementWorkspace } from "@/lib/placement-workflow";

export const metadata: Metadata = {
  title: "Home",
  description: "Your guided housing placement workspace.",
};

// ── Demo adapters ──────────────────────────────────────────────────────────────

function demoProjectsAsViews() {
  // Map demo stage keys to the closest workflow status for CTA derivation
  const stageToStatus: Record<string, string> = {
    "research": "researching_city",
    "find-housing": "finding_property",
    "secure-property": "application_in_progress",
    "match-resident": "seeking_referrals",
    "move-in": "move_in_scheduled",
  };
  return DEMO_PROJECTS.map((p) => ({
    id: p.id,
    name: p.name,
    community: p.community,
    currentStage: p.currentStage as string,
    currentStatus: stageToStatus[p.currentStage] ?? "researching_city",
    nextAction: null as string | null,
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
  const { organizationId } = await requireOrganization();

  // ── Fetch data — fall back to demo on failure ──────────────────────────────
  const [dbActiveProjects, dbTasks] = await Promise.all([
    listActiveProjects(organizationId),
    listTasks(organizationId),
  ]);

  const usingDemo = isDemoAllowed() && (dbActiveProjects === null || dbTasks === null);

  if (!usingDemo && (dbActiveProjects === null || dbTasks === null)) {
    redirect("/unavailable");
  }

  const activeProjects = usingDemo
    ? demoProjectsAsViews().filter((p) => p.groupStatus === "active")
    : dbActiveProjects!.map((p) => ({
        id: p.id,
        name: p.name,
        community: p.community,
        currentStage: p.currentStage,
        currentStatus: p.currentStatus,
        nextAction: p.nextAction,
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

  // ── Primary CTA derivation (project-aware) ────────────────────────────────
  // Statuses eligible for property search — Research gate enforced here too.
  const FIND_PROPERTIES_STATUSES = new Set([
    "city_approved",
    "finding_property",
  ]);
  const SECURE_PROPERTY_STATUSES = new Set([
    "contacting_owner",
    "application_in_progress",
    "property_approved",
  ]);

  type PrimaryAction =
    | { label: string; href: string; isPrimary: true }
    | null;

  function derivePrimaryAction(): PrimaryAction {
    if (!primaryProject) {
      return { label: "Start New Placement", href: "/projects/new", isPrimary: true };
    }
    const status = (primaryProject as { currentStatus?: string }).currentStatus
      ?? primaryProject.currentStage; // currentStage is the stage key; currentStatus is the raw status
    if (status === "researching_city") {
      return { label: "Complete Market Research", href: `/projects/${primaryProject.id}`, isPrimary: true };
    }
    if (FIND_PROPERTIES_STATUSES.has(status)) {
      return { label: "Find Properties", href: `/housing-search?project=${primaryProject.id}`, isPrimary: true };
    }
    if (SECURE_PROPERTY_STATUSES.has(status)) {
      return { label: "Secure Property", href: `/housing-search?project=${primaryProject.id}`, isPrimary: true };
    }
    if (canUsePlacementWorkspace(status)) {
      return {
        label: status === "moved_in" ? "View Completed Placement" : "Continue Placement",
        href: `/projects/${primaryProject.id}/placement`,
        isPrimary: true,
      };
    }
    // Other active statuses — use project's nextAction if available, or open project
    const nextActionLabel = (primaryProject as { nextAction?: string | null }).nextAction
      ?? `Continue: ${primaryProject.name}`;
    return { label: nextActionLabel, href: `/projects/${primaryProject.id}`, isPrimary: true };
  }

  const primaryAction = derivePrimaryAction();

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
              ? primaryProject.name
              : "No active projects"}
          </h1>

          {primaryProject?.blocker && (
            <div className="mb-5">
              <BlockerAlert blocker={primaryProject.blocker} />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {/* Primary CTA — project-aware, always dominant */}
            {primaryAction && (
              <Link
                href={primaryAction.href}
                className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white"
                style={{ backgroundColor: "var(--color-action)" }}
              >
                {primaryAction.label}
                <span aria-hidden="true">→</span>
              </Link>
            )}

            {/* Secondary — open existing project */}
            {primaryProject && (
              <Link
                href={`/projects/${primaryProject.id}`}
                className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium"
                style={{
                  backgroundColor: "transparent",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-primary)",
                  opacity: 0.75,
                }}
              >
                Open project
                <span aria-hidden="true">→</span>
              </Link>
            )}

            {/* Always keep a clear way to begin another placement. */}
            {primaryProject && (
              <Link
                href="/projects/new"
                className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold"
                style={{
                  backgroundColor: "white",
                  border: "1px solid var(--color-primary)",
                  color: "var(--color-primary)",
                }}
              >
                + Start New Placement
              </Link>
            )}
          </div>
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
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2
            id="active-projects-heading"
            className="text-base font-semibold"
            style={{ color: "var(--color-primary)" }}
          >
            Active Projects
          </h2>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/projects/new"
              className="text-xs font-semibold"
              style={{ color: "var(--color-action)" }}
            >
              + New Placement
            </Link>
            <Link
              href="/projects"
              className="text-xs font-medium"
              style={{ color: "var(--color-secondary)" }}
            >
              View all projects →
            </Link>
          </div>
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
