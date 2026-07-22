/**
 * /tasks — Task management across all projects.
 *
 * Three sections: Today · Upcoming · Completed
 * Checkbox indicators are visual only in Phase 1 — no interactive completion.
 */
import type { Metadata } from "next";
import { DEMO_TASKS } from "@/demo/data";

export const metadata: Metadata = {
  title: "Tasks",
  description: "Today's tasks, upcoming tasks, and completed tasks.",
};

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function statusLabel(status: string): { icon: string; text: string } {
  switch (status) {
    case "completed":
      return { icon: "✓", text: "Completed" };
    case "today":
      return { icon: "●", text: "Today" };
    default:
      return { icon: "◌", text: "Upcoming" };
  }
}

function TaskRow({
  task,
  done = false,
}: {
  task: (typeof DEMO_TASKS)[0];
  done?: boolean;
}) {
  const { icon, text } = statusLabel(task.status);

  return (
    <li
      className={[
        "flex items-start gap-3 px-4 py-3.5 rounded-lg",
        done ? "opacity-55" : "",
      ].join(" ")}
      style={{
        backgroundColor: done ? "transparent" : "var(--color-surface-soft)",
        border: "1px solid var(--color-border)",
      }}
    >
      {/* Static status indicator — not interactive */}
      <span
        className="shrink-0 mt-0.5 text-xs font-semibold w-16 text-right"
        style={{
          color: done
            ? "var(--color-secondary)"
            : task.status === "today"
            ? "var(--color-action)"
            : "var(--color-text-muted)",
        }}
        aria-label={text}
      >
        {icon} {text}
      </span>

      <div className="flex-1 min-w-0">
        <p
          className={[
            "text-sm font-medium leading-snug",
            done ? "line-through" : "",
          ].join(" ")}
          style={{ color: "var(--color-text)" }}
        >
          {task.title}
        </p>
        <div
          className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs"
          style={{ color: "var(--color-text)", opacity: 0.55 }}
        >
          <span>{task.projectName}</span>
          <span aria-hidden="true">·</span>
          <span>
            Due{" "}
            <time dateTime={task.dueDate}>{formatDate(task.dueDate)}</time>
          </span>
        </div>
      </div>
    </li>
  );
}

export default function TasksPage() {
  const today = DEMO_TASKS.filter((t) => t.status === "today");
  const upcoming = DEMO_TASKS.filter((t) => t.status === "upcoming");
  const completed = DEMO_TASKS.filter((t) => t.status === "completed");

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 lg:px-10">
      {/* Page header */}
      <div className="mb-8">
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--color-primary)" }}
        >
          Tasks
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--color-text)", opacity: 0.6 }}
        >
          {today.length} due today &mdash; {upcoming.length} upcoming &mdash;{" "}
          {completed.length} completed
        </p>
      </div>

      {/* ── Today ───────────────────────────────────────────────────── */}
      <section aria-labelledby="today-heading" className="mb-10">
        <h2
          id="today-heading"
          className="text-sm font-semibold uppercase tracking-widest mb-3"
          style={{ color: "var(--color-text)", opacity: 0.75 }}
        >
          Today ({today.length})
        </h2>
        {today.length === 0 ? (
          <p
            className="text-sm"
            style={{ color: "var(--color-text)", opacity: 0.6 }}
          >
            No tasks due today.
          </p>
        ) : (
          <ul className="space-y-2">
            {today.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        )}
      </section>

      {/* ── Upcoming ────────────────────────────────────────────────── */}
      <section aria-labelledby="upcoming-heading" className="mb-10">
        <h2
          id="upcoming-heading"
          className="text-sm font-semibold uppercase tracking-widest mb-3"
          style={{ color: "var(--color-text)", opacity: 0.75 }}
        >
          Upcoming ({upcoming.length})
        </h2>
        {upcoming.length === 0 ? (
          <p
            className="text-sm"
            style={{ color: "var(--color-text)", opacity: 0.6 }}
          >
            No upcoming tasks.
          </p>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        )}
      </section>

      {/* ── Completed ───────────────────────────────────────────────── */}
      <section aria-labelledby="completed-heading">
        <h2
          id="completed-heading"
          className="text-sm font-semibold uppercase tracking-widest mb-3"
          style={{ color: "var(--color-text)", opacity: 0.75 }}
        >
          Completed ({completed.length})
        </h2>
        {completed.length === 0 ? (
          <p
            className="text-sm"
            style={{ color: "var(--color-text)", opacity: 0.6 }}
          >
            No completed tasks yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {completed.map((task) => (
              <TaskRow key={task.id} task={task} done />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
