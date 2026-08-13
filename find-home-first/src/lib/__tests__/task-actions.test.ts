import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const actions = readFileSync(resolve(process.cwd(), "src/app/tasks/actions.ts"), "utf8");
const client = readFileSync(resolve(process.cwd(), "src/app/tasks/TasksClient.tsx"), "utf8");

describe("task action security and interaction contracts", () => {
  it("authenticates every task mutation from the server", () => {
    expect(actions.match(/requireOrganization\(\)/g)?.length).toBe(2);
  });

  it("verifies a selected project belongs to the authenticated organization", () => {
    expect(actions).toContain("projectBelongsToOrg(projectId, organizationId)");
  });

  it("scopes task updates by both task ID and organization ID", () => {
    expect(actions).toContain("eq(tasks.id, taskId)");
    expect(actions).toContain("eq(tasks.organizationId, organizationId)");
  });

  it("records completion time and clears it when a task is reopened", () => {
    expect(actions).toContain("completedAt: completed ? new Date() : null");
  });

  it("uses non-submit buttons for disclosure and completion controls", () => {
    expect(client.match(/type="button"/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps the Add Task control as the only task-creation submit button", () => {
    expect(client.match(/type="submit"/g)?.length).toBe(1);
    expect(client).toContain("Add Task");
  });
});

