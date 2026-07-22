/**
 * /tasks — Tasks
 *
 * Structure only. Visual design is REPLIT-UI ownership.
 *
 * Required content per GUIDED_WORKSPACE_UI_SPEC.md:
 * - Section 1: Today — tasks due today
 * - Section 2: Upcoming — tasks due after today
 * - Section 3: Completed — completed tasks
 * - Each task shows: title, project name, due date, status
 */
import type { Metadata } from "next";
import { DEMO_TASKS } from "@/demo/data";

export const metadata: Metadata = {
  title: "Tasks",
  description: "Today's tasks, upcoming tasks, and completed tasks.",
};

export default function TasksPage() {
  const today = DEMO_TASKS.filter((t) => t.status === "today");
  const upcoming = DEMO_TASKS.filter((t) => t.status === "upcoming");
  const completed = DEMO_TASKS.filter((t) => t.status === "completed");

  return (
    <div>
      <h1>Tasks</h1>
      <p>
        {today.length} due today &mdash; {upcoming.length} upcoming &mdash;{" "}
        {completed.length} completed
      </p>

      {/* Today */}
      <section aria-labelledby="today-heading">
        <h2 id="today-heading">Today ({today.length})</h2>
        {today.length === 0 ? (
          <p>No tasks due today.</p>
        ) : (
          <ul>
            {today.map((task) => (
              <li key={task.id}>
                {task.title} — {task.projectName} — due {task.dueDate}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Upcoming */}
      <section aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading">Upcoming ({upcoming.length})</h2>
        {upcoming.length === 0 ? (
          <p>No upcoming tasks.</p>
        ) : (
          <ul>
            {upcoming.map((task) => (
              <li key={task.id}>
                {task.title} — {task.projectName} — due {task.dueDate}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Completed */}
      <section aria-labelledby="completed-heading">
        <h2 id="completed-heading">Completed ({completed.length})</h2>
        {completed.length === 0 ? (
          <p>No completed tasks yet.</p>
        ) : (
          <ul>
            {completed.map((task) => (
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
