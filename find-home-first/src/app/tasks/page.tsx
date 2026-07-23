/**
 * /tasks — Task management across all projects.
 *
 * Three sections: Today · Upcoming · Completed
 * Checkbox indicators are visual only in Phase 1 — no interactive completion.
 *
 * Data source: PostgreSQL via repository when DATABASE_URL is set,
 * otherwise falls back to src/demo/data.ts.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DEMO_TASKS } from "@/demo/data";
import { listTasks, isDemoAllowed } from "@/lib/repository";
import type { TaskView } from "@/lib/repository";
import { requireOrganization } from "@/lib/auth";
import DemoNotice from "@/components/DemoNotice";

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

interface TaskRowData {
  id: string;
  title: string;
  projectName: string | null;
  dueDate: string | null;
  status: string;
}

function TaskRow({ task, done = false }: { task: TaskRowData; done?: boolean }) {
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
          {task.projectName && <span>{task.projectName}</span>}
          {task.projectName && task.dueDate && (
            <span aria-hidden="true">·</span>
          )}
          {task.dueDate && (
            <span>
              Due{" "}
              <time dateTime={task.dueDate}>{formatDate(task.dueDate)}</time>
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

// ── Demo adapter ──────────────────────────────────────────────────────────────

function demoTaskRows(): TaskRowData[] {
  return DEMO_TASKS.map((t) => ({
    id: t.id,
    title: t.title,
    projectName: t.projectName,
    dueDate: t.dueDate,
    status: t.status,
  }));
}

function dbTaskRows(rows: TaskView[]): TaskRowData[] {
  return rows.map((t) => ({
    id: t.id,
    title: t.title,
    projectName: t.projectName,
    dueDate: t.dueDate,
    status: t.status,
  }));
}

export default async function TasksPage() {
  const { organizationId } = await requireOrganization();
  const dbTasks = await listTasks(organizationId);
  const usingDemo = isDemoAllowed() && dbTasks === null;

  if (!usingDemo && dbTasks === null) {
    redirect("/unavailable");
  }

  const allTasks: TaskRowData[] = usingDemo
    ? demoTaskRows()
    : dbTaskRows(dbTasks!);

  const today = allTasks.filter((t) => t.status === "today");
  const upcoming = allTasks.filter((t) => t.status === "upcoming");
  const completed = allTasks.filter((t) => t.status === "completed");

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 lg:px-10">
      {/* Page header */}
      <div className="mb-8">
        {usingDemo && <DemoNotice />}
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
