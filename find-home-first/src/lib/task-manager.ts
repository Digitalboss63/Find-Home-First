import type { TaskView } from "@/lib/repository";

export type TaskBucket = "overdue" | "today" | "upcoming" | "completed";

export interface TaskGroups {
  overdue: TaskView[];
  today: TaskView[];
  upcoming: TaskView[];
  completed: TaskView[];
}

/** Group open tasks from due dates instead of the stale legacy "today" status. */
export function taskBucket(task: TaskView, todayIso: string): TaskBucket {
  if (task.status === "completed") return "completed";
  if (!task.dueDate) return "upcoming";
  if (task.dueDate < todayIso) return "overdue";
  if (task.dueDate === todayIso) return "today";
  return "upcoming";
}

export function groupTasks(taskRows: TaskView[], todayIso: string): TaskGroups {
  const groups: TaskGroups = { overdue: [], today: [], upcoming: [], completed: [] };
  for (const task of taskRows) groups[taskBucket(task, todayIso)].push(task);
  return groups;
}

