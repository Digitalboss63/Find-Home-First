/**
 * /projects — Projects list
 *
 * Structure only. Visual design is REPLIT-UI ownership.
 *
 * Required content per GUIDED_WORKSPACE_UI_SPEC.md:
 * - List of all projects grouped by status (active / on-hold / completed)
 * - Each project shows: name, community, resident, current stage, target move-in, blocker if present
 * - "New Project" action — disabled until authentication exists
 */
import type { Metadata } from "next";
import Link from "next/link";
import { DEMO_PROJECTS } from "@/demo/data";

export const metadata: Metadata = {
  title: "Projects",
  description: "All housing placement projects.",
};

export default function ProjectsPage() {
  const active = DEMO_PROJECTS.filter((p) => p.status === "active");
  const onHold = DEMO_PROJECTS.filter((p) => p.status === "on-hold");
  const completed = DEMO_PROJECTS.filter((p) => p.status === "completed");

  return (
    <div>
      <h1>Projects</h1>
      <p>
        {DEMO_PROJECTS.length} total — {active.length} active
      </p>

      {active.length > 0 && (
        <section aria-labelledby="active-heading">
          <h2 id="active-heading">Active</h2>
          <ul>
            {active.map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`}>{p.name}</Link>
                <span> — {p.community}</span>
                <span> — Resident: {p.residentName}</span>
                <span> — Stage: {p.currentStage}</span>
                <span> — Target move-in: {p.targetMoveIn}</span>
                {p.blocker && (
                  <span role="alert"> ⚠ Blocker: {p.blocker}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {onHold.length > 0 && (
        <section aria-labelledby="on-hold-heading">
          <h2 id="on-hold-heading">On Hold</h2>
          <ul>
            {onHold.map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`}>{p.name}</Link>
                <span> — {p.residentName}</span>
                {p.blocker && (
                  <span role="alert"> ⚠ Blocker: {p.blocker}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {completed.length > 0 && (
        <section aria-labelledby="completed-heading">
          <h2 id="completed-heading">Completed</h2>
          <ul>
            {completed.map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`}>{p.name}</Link>
                <span> — {p.residentName}</span>
                <span> — Moved in: {p.targetMoveIn}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
