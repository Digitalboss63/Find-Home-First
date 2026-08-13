"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import type { ProjectView, TaskView } from "@/lib/repository";
import { groupTasks, type TaskBucket } from "@/lib/task-manager";
import { createTaskAction, initialTaskActionState, setTaskCompletedAction } from "./actions";

interface TasksClientProps {
  tasks: TaskView[];
  projects: Pick<ProjectView, "id" | "name">[];
  todayIso: string;
  readOnly?: boolean;
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function TaskRow({ task, bucket, readOnly }: {
  task: TaskView; bucket: TaskBucket; readOnly: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const completed = bucket === "completed";

  function toggle() {
    setMessage("");
    startTransition(async () => {
      const result = await setTaskCompletedAction(task.id, !completed);
      if (!result.ok) setMessage(result.message);
    });
  }

  return (
    <li
      className={`rounded-lg border px-4 py-3.5 ${completed ? "opacity-60" : ""}`}
      style={{
        borderColor: bucket === "overdue" ? "#dc8a7b" : "var(--color-border)",
        backgroundColor: completed ? "transparent" : "var(--color-surface-soft)",
      }}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={readOnly || pending}
          aria-label={completed ? `Reopen ${task.title}` : `Complete ${task.title}`}
          title={completed ? "Reopen task" : "Mark complete"}
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border text-sm font-bold disabled:cursor-not-allowed"
          style={{
            borderColor: completed ? "#16a34a" : "var(--color-secondary)",
            backgroundColor: completed ? "#16a34a" : "white",
            color: completed ? "white" : "var(--color-primary)",
          }}
        >
          {pending ? "…" : completed ? "✓" : ""}
        </button>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium leading-snug ${completed ? "line-through" : ""}`}>{task.title}</p>
          <div className="mt-1 flex flex-wrap gap-x-3 text-xs opacity-60">
            {task.projectId && task.projectName ? (
              <Link href={`/projects/${task.projectId}`} className="underline">{task.projectName}</Link>
            ) : task.projectName ? <span>{task.projectName}</span> : null}
            {task.dueDate && <span>Due <time dateTime={task.dueDate}>{formatDate(task.dueDate)}</time></span>}
            {!task.dueDate && !completed && <span>No due date</span>}
          </div>
          {message && <p role="alert" className="mt-1 text-xs text-red-700">{message}</p>}
        </div>
      </div>
    </li>
  );
}

function TaskSection({ id, title, empty, tasks, bucket, readOnly }: {
  id: string; title: string; empty: string; tasks: TaskView[]; bucket: TaskBucket; readOnly: boolean;
}) {
  return (
    <section aria-labelledby={id} className="mb-9">
      <h2 id={id} className="mb-3 text-sm font-semibold uppercase tracking-widest opacity-75">
        {title} ({tasks.length})
      </h2>
      {tasks.length === 0 ? <p className="text-sm opacity-60">{empty}</p> : (
        <ul className="space-y-2">
          {tasks.map((task) => <TaskRow key={task.id} task={task} bucket={bucket} readOnly={readOnly} />)}
        </ul>
      )}
    </section>
  );
}

export default function TasksClient({ tasks, projects, todayIso, readOnly = false }: TasksClientProps) {
  const [showForm, setShowForm] = useState(false);
  const [state, formAction, pending] = useActionState(createTaskAction, initialTaskActionState);
  const groups = groupTasks(tasks, todayIso);

  return (
    <>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm opacity-60">
          {groups.overdue.length} overdue · {groups.today.length} due today · {groups.upcoming.length} upcoming
        </p>
        {!readOnly && (
          <button
            type="button" onClick={() => setShowForm((value) => !value)}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: "var(--color-action)" }} aria-expanded={showForm}
          >
            {showForm ? "Cancel" : "+ Add Task"}
          </button>
        )}
      </div>

      {showForm && (
        <form action={formAction} className="mb-9 rounded-xl border p-5"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface-soft)" }}>
          <h2 className="mb-4 text-base font-semibold">Add a task</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium md:col-span-2">
              Task title
              <input name="title" required maxLength={200} placeholder="e.g. Call the property owner"
                className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal" />
            </label>
            <label className="text-sm font-medium">
              Project (optional)
              <select name="projectId" className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal">
                <option value="">No project</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">
              Due date (optional)
              <input name="dueDate" type="date" className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal" />
            </label>
          </div>
          {state.message && (
            <p role={state.ok ? "status" : "alert"} className={`mt-3 text-sm ${state.ok ? "text-green-700" : "text-red-700"}`}>
              {state.message}
            </p>
          )}
          <button type="submit" disabled={pending}
            className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "var(--color-action)" }}>
            {pending ? "Adding…" : "Add Task"}
          </button>
        </form>
      )}

      {groups.overdue.length > 0 && <TaskSection id="overdue-heading" title="Overdue" empty="No overdue tasks."
        tasks={groups.overdue} bucket="overdue" readOnly={readOnly} />}
      <TaskSection id="today-heading" title="Today" empty="No tasks due today."
        tasks={groups.today} bucket="today" readOnly={readOnly} />
      <TaskSection id="upcoming-heading" title="Upcoming" empty="No upcoming tasks."
        tasks={groups.upcoming} bucket="upcoming" readOnly={readOnly} />
      <TaskSection id="completed-heading" title="Completed" empty="No completed tasks yet."
        tasks={groups.completed} bucket="completed" readOnly={readOnly} />
    </>
  );
}
