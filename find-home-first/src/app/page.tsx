/**
 * / — Home workspace
 *
 * Structure only. Visual design is REPLIT-UI ownership.
 *
 * Required content per GUIDED_WORKSPACE_UI_SPEC.md:
 * - One primary next action (derived from active project with blocker, or highest-priority task)
 * - Blocker alert (conditional — only shown when a blocker exists)
 * - Five-stage placement journey summary
 * - Active projects list
 * - Today's tasks list
 */
import type { Metadata } from "next";
import Link from "next/link";
import { DEMO_PROJECTS, DEMO_TASKS, STAGES } from "@/demo/data";

export const metadata: Metadata = {
  title: "Home",
  description: "Your guided housing placement workspace.",
};

export default function HomePage() {
  const activeProjects = DEMO_PROJECTS.filter((p) => p.status === "active");
  const blockedProject = activeProjects.find((p) => p.blocker);
  const todayTasks = DEMO_TASKS.filter((t) => t.status === "today");

  return (
    <div>
      {/* Primary next action */}
      <section aria-labelledby="primary-action-heading">
        <h1 id="primary-action-heading">Follow up on the Eastside lease signature</h1>

        {/* Blocker alert — only rendered when a blocker exists */}
        {blockedProject?.blocker && (
          <div role="alert" aria-live="polite">
            <p>Blocker: {blockedProject.blocker}</p>
          </div>
        )}

        <Link href={`/projects/${blockedProject?.id ?? "proj-001"}`}>
          Open project
        </Link>
      </section>

      {/* Placement journey — five stages */}
      <section aria-labelledby="journey-heading">
        <h2 id="journey-heading">Placement Journey</h2>
        <ol aria-label="Five placement stages">
          {STAGES.map((stage) => (
            <li key={stage.key}>
              <strong>{stage.label}</strong>: {stage.description}
            </li>
          ))}
        </ol>
      </section>

      {/* Active projects */}
      <section aria-labelledby="active-projects-heading">
        <h2 id="active-projects-heading">Active Projects</h2>
        <Link href="/projects">View all projects</Link>
        {activeProjects.length === 0 ? (
          <p>No active projects.</p>
        ) : (
          <ul>
            {activeProjects.map((project) => (
              <li key={project.id}>
                <Link href={`/projects/${project.id}`}>
                  {project.name}
                </Link>
                <span> — {project.residentName}</span>
                <span> — Stage: {project.currentStage}</span>
                {project.blocker && (
                  <span role="alert"> ⚠ Blocker: {project.blocker}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Today's tasks */}
      <section aria-labelledby="today-tasks-heading">
        <h2 id="today-tasks-heading">Today&rsquo;s Tasks</h2>
        <Link href="/tasks">All tasks</Link>
        {todayTasks.length === 0 ? (
          <p>No tasks due today.</p>
        ) : (
          <ul>
            {todayTasks.map((task) => (
              <li key={task.id}>
                {task.title} — {task.projectName}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
