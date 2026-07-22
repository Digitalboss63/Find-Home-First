/**
 * /projects/[id] — Project workspace
 *
 * Structure only. Visual design is REPLIT-UI ownership.
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
import { DEMO_PROJECTS, DEMO_TASKS, STAGES } from "@/demo/data";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const project = DEMO_PROJECTS.find((p) => p.id === id);
  return { title: project?.name ?? "Project Not Found" };
}

export async function generateStaticParams() {
  return DEMO_PROJECTS.map((p) => ({ id: p.id }));
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  const project = DEMO_PROJECTS.find((p) => p.id === id);
  if (!project) notFound();

  const currentStageIndex = STAGES.findIndex((s) => s.key === project.currentStage);
  const projectTasks = DEMO_TASKS.filter((t) => t.projectId === project.id);
  const openTasks = projectTasks.filter((t) => t.status !== "completed");
  const completedTasks = projectTasks.filter((t) => t.status === "completed");

  return (
    <div>
      <Link href="/projects">← All Projects</Link>

      <h1>{project.name}</h1>
      <p>Community: {project.community}</p>
      <p>Resident: {project.residentName}</p>
      <p>Target move-in: {project.targetMoveIn}</p>
      <p>Status: {project.status}</p>

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
              <li
                key={stage.key}
                aria-current={active ? "step" : undefined}
              >
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
