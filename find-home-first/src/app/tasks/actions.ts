"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { tasks } from "@/db/schema";
import { requireOrganization } from "@/lib/auth";
import { projectBelongsToOrg } from "@/lib/repository";

export interface TaskActionState { ok: boolean; message: string }
export const initialTaskActionState: TaskActionState = { ok: false, message: "" };

function textField(formData: FormData, name: string, max: number): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function createTaskAction(
  _previousState: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  try {
    const { organizationId } = await requireOrganization();
    const db = getDb();
    if (!db) return { ok: false, message: "Tasks are temporarily unavailable." };

    const title = textField(formData, "title", 200);
    const projectId = textField(formData, "projectId", 100) || null;
    const dueDate = textField(formData, "dueDate", 10) || null;
    if (!title) return { ok: false, message: "Enter a task title." };
    if (dueDate && !validIsoDate(dueDate)) return { ok: false, message: "Choose a valid due date." };
    if (projectId && !(await projectBelongsToOrg(projectId, organizationId))) {
      return { ok: false, message: "That project is not available." };
    }

    await db.insert(tasks).values({ organizationId, projectId, title, dueDate, status: "upcoming" });
    revalidatePath("/tasks");
    revalidatePath("/");
    if (projectId) revalidatePath(`/projects/${projectId}`);
    return { ok: true, message: "Task added." };
  } catch {
    return { ok: false, message: "The task could not be added." };
  }
}

export async function setTaskCompletedAction(
  taskId: string,
  completed: boolean,
): Promise<TaskActionState> {
  try {
    const { organizationId } = await requireOrganization();
    const db = getDb();
    if (!db) return { ok: false, message: "Tasks are temporarily unavailable." };
    if (!taskId) return { ok: false, message: "Task not found." };

    const changed = await db
      .update(tasks)
      .set({
        status: completed ? "completed" : "upcoming",
        completedAt: completed ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.organizationId, organizationId)))
      .returning({ id: tasks.id, projectId: tasks.projectId });
    if (changed.length !== 1) return { ok: false, message: "Task not found." };

    revalidatePath("/tasks");
    revalidatePath("/");
    if (changed[0].projectId) revalidatePath(`/projects/${changed[0].projectId}`);
    return { ok: true, message: completed ? "Task completed." : "Task reopened." };
  } catch {
    return { ok: false, message: "The task could not be updated." };
  }
}

