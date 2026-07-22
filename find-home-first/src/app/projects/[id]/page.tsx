/**
 * /projects/[id] — Project workspace
 *
 * Data source: PostgreSQL via repository when DATABASE_URL is set,
 * otherwise falls back to src/demo/data.ts.
 *
 * Required content per GUIDED_WORKSPACE_UI_SPEC.md:
 * - Project name, community, resident, target move-in
 * - Blocker alert (conditional)
 * - Five-stage placement journey with current stage marked
 * - Stage notes for completed and current stages
 * - Tasks for this project (open and completed)
 * - Back link to /projects
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DEMO_PROJECTS, DEMO_TASKS } from "@/demo/data";
import { getProjectById, listTasksForProject } from "@/lib/repository";
import { STAGES } from "@/lib/stages";

interface Props {
  params: Promise<{ id: string }>;
}

// ── Demo adapters ──────────────────────────────────────────────────────────────

function demoProjectView(id: string) {
  const p = DEMO_PROJECTS.find((p) => p.id === id);
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    community: p.community,
    currentStage: p.currentStage as string,
    targetMoveIn: p.targetMoveIn as string | null,
    blocker: p.blocker ?? null,
    residentName: p.residentName as string | null,
  };
}

function demoTaskViews(projectId: string) {
  return DEMO_TASKS.filter((t) => t.projectId === projectId).map((t) => ({
    id: t.id,
    title: t.title,
    dueDate: t.dueDate as string | null,
    status: t.status,
  }));
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  // Try DB first, fall back to demo
  const dbProject = await getProjectById(id);
  if (dbProject) return { title: dbProject.name };

  const demo = DEMO_PROJECTS.find((p) => p.id === id);
  return { title: demo?.name ?? "Project Not Found" };
}

// No generateStaticParams — dynamic rendering required for DB-backed pages.
export const dynamic = "force-dynamic";

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;

  // Attempt DB lookup
  const dbProject = await getProjectById(id);
  const dbTasks = dbProject ? await listTasksForProject(id) : null;

  const usingDemo = dbProject === null;

  const project = usingDemo ? demoProjectView(id) : {
    id: dbProject.id,
    name: dbProject.name,
    community: dbProject.community,
    currentStage: dbProject.currentStage,
    targetMoveIn: dbProject.targetMoveIn,
    blocker: dbProject.blocker,
    residentName: dbProject.residentName,
  };

  if (!project) notFound();

  const allTasks = usingDemo
    ? demoTaskViews(id)
    : (dbTasks ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate,
        status: t.status,
      }));

  const currentStageIndex = STAGES.findIndex(
    (s) => s.key === project.currentStage
  );
  const openTasks = allTasks.filter((t) => t.status !== "completed");
  const completedTasks = allTasks.filter((t) => t.status === "completed");

  return (
    <div>
      <Link href="/projects">← All Projects</Link>

      <h1>{project.name}</h1>
      <p>Community: {project.community}</p>
      {project.residentName && <p>Resident: {project.residentName}</p>}
      {project.targetMoveIn && <p>Target move-in: {project.targetMoveIn}</p>}

      {/* Blocker alert — conditional */}
      {project.blocker && (
        <div role="alert" aria-live="polite">
          <p>Blocker: {project.blocker}</p>
        </div>
      )}

      {/* Five-stage placement journey */}
      <section aria-labelledby="journey-heading">
        <h2 id="journey-heading">Placement Journey</h2>
        <ol aria-label="Placement journey stages">
          {STAGES.map((stage, i) => {
            const done = i < currentStageIndex;
            const active = i === currentStageIndex;
            return (
              <li key={stage.key} aria-current={active ? "step" : undefined}>
                <strong>{stage.label}</strong>
                {done && " (completed)"}
                {active && " (current)"}
                <span> — {stage.description}</span>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Tasks */}
      <section aria-labelledby="tasks-heading">
        <h2 id="tasks-heading">Tasks</h2>
        <Link href="/tasks">All tasks</Link>

        {openTasks.length === 0 && completedTasks.length === 0 ? (
          <p>No tasks for this project.</p>
        ) : (
          <>
            {openTasks.length > 0 && (
              <>
                <h3>Open</h3>
                <ul>
                  {openTasks.map((task) => (
                    <li key={task.id}>
                      {task.title} — due {task.dueDate}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {completedTasks.length > 0 && (
              <>
                <h3>Completed</h3>
                <ul>
                  {completedTasks.map((task) => (
                    <li key={task.id}>{task.title}</li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
