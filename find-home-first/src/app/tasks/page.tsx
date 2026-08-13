/** /tasks — simple organization-wide task manager. */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import DemoNotice from "@/components/DemoNotice";
import { requireOrganization } from "@/lib/auth";
import { DEMO_TASKS } from "@/demo/data";
import {
  isDemoAllowed,
  listActiveProjects,
  listTasks,
  type TaskView,
} from "@/lib/repository";
import TasksClient from "./TasksClient";

export const metadata: Metadata = {
  title: "Tasks",
  description: "Create, organize, and complete tasks across placement projects.",
};

function todayInAppTimeZone(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: process.env.APP_TIME_ZONE || "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
function demoTasks(): TaskView[] {
  return DEMO_TASKS.map((task) => ({
    id: task.id,
    title: task.title,
    description: null,
    projectId: null,
    projectName: task.projectName,
    dueDate: task.dueDate,
    status: task.status,
  }));
}

export default async function TasksPage() {
  const { organizationId } = await requireOrganization();
  const [taskRows, projectRows] = await Promise.all([
    listTasks(organizationId),
    listActiveProjects(organizationId),
  ]);
  const usingDemo = isDemoAllowed() && taskRows === null;

  if (!usingDemo && (taskRows === null || projectRows === null)) redirect("/unavailable");

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 lg:px-10">
      {usingDemo && <DemoNotice />}
      <div className="mb-7">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-primary)" }}>Tasks</h1>
        <p className="mt-1 text-sm opacity-60">Keep follow-ups and placement work in one simple list.</p>
      </div>
      <TasksClient
        tasks={usingDemo ? demoTasks() : taskRows!}
        projects={(projectRows ?? []).map(({ id, name }) => ({ id, name }))}
        todayIso={todayInAppTimeZone()}
        readOnly={usingDemo}
      />
    </div>
  );
}
