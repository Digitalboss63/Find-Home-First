import { describe, expect, it } from "vitest";
import type { TaskView } from "@/lib/repository";
import { groupTasks, taskBucket } from "@/lib/task-manager";

function task(overrides: Partial<TaskView> = {}): TaskView {
  return {
    id: "task-1", title: "Call owner", description: null, projectId: null,
    projectName: null, dueDate: null, status: "upcoming", ...overrides,
  };
}

describe("task date grouping", () => {
  const today = "2026-08-13";

  it("puts an open past-due task in Overdue", () => {
    expect(taskBucket(task({ dueDate: "2026-08-12" }), today)).toBe("overdue");
  });
  it("puts a task due today in Today without stored today status", () => {
    expect(taskBucket(task({ dueDate: today }), today)).toBe("today");
  });
  it("puts a future task in Upcoming", () => {
    expect(taskBucket(task({ dueDate: "2026-08-14" }), today)).toBe("upcoming");
  });
  it("puts a task without a date in Upcoming", () => {
    expect(taskBucket(task(), today)).toBe("upcoming");
  });
  it("keeps completed tasks in Completed even when overdue", () => {
    expect(taskBucket(task({ dueDate: "2026-01-01", status: "completed" }), today)).toBe("completed");
  });
  it("groups every task exactly once", () => {
    const grouped = groupTasks([
      task({ id: "1", dueDate: "2026-08-12" }), task({ id: "2", dueDate: today }),
      task({ id: "3", dueDate: "2026-08-14" }), task({ id: "4", status: "completed" }),
    ], today);
    expect(grouped.overdue.map(({ id }) => id)).toEqual(["1"]);
    expect(grouped.today.map(({ id }) => id)).toEqual(["2"]);
    expect(grouped.upcoming.map(({ id }) => id)).toEqual(["3"]);
    expect(grouped.completed.map(({ id }) => id)).toEqual(["4"]);
  });
});

