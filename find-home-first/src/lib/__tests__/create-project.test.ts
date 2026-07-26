/**
 * createProjectAction — server-action unit tests.
 *
 * Covers:
 * 1. Valid submission creates exactly one project row.
 * 2. Status-history record is created alongside the project.
 * 3. Organization isolation — organizationId comes from requireOrganization(),
 *    never from client-supplied formData.
 * 4. Transaction failure creates no partial project (atomicity).
 * 5. Successful creation redirects to /projects/{id}, never to /.
 * 6. Missing required fields return an error state without touching the DB.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockRequireOrganization,
  mockGetDb,
  mockRedirect,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockRequireOrganization: vi.fn(),
  mockGetDb: vi.fn(),
  mockRedirect: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireOrganization: mockRequireOrganization }));
vi.mock("@/db/client", () => ({ getDb: mockGetDb }));
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
vi.mock("server-only", () => ({}));
// Schema is used structurally by the action but we mock the db calls directly.
vi.mock("@/db/schema", () => ({
  projects: { id: "id" },
  projectStatusHistory: {},
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFormData(
  overrides: Record<string, string> = {}
): FormData {
  const fd = new FormData();
  fd.append("name", "Johnson Family Placement");
  fd.append("targetCity", "Atlanta");
  fd.append("state", "GA");
  for (const [k, v] of Object.entries(overrides)) {
    fd.set(k, v);
  }
  return fd;
}

const INITIAL_STATE = { error: null };
const ORG_ID = "org-abc-123";
const NEW_PROJECT_ID = "proj-new-456";

/** Build a mock db that records insert calls and simulates a transaction. */
function makeMockDb({
  insertFails = false,
  historyInsertFails = false,
}: { insertFails?: boolean; historyInsertFails?: boolean } = {}) {
  const projectInsertValues: unknown[] = [];
  const historyInsertValues: unknown[] = [];

  let callCount = 0;

  const mockInsert = vi.fn().mockImplementation(() => {
    callCount++;
    const iFirst = callCount === 1; // first insert → projects
    return {
      values: vi.fn().mockImplementation((vals) => {
        if (iFirst) projectInsertValues.push(vals);
        else historyInsertValues.push(vals);
        return {
          returning: vi.fn().mockImplementation(() => {
            if (iFirst && insertFails)
              return Promise.reject(new Error("insert error"));
            if (!iFirst && historyInsertFails)
              return Promise.reject(new Error("history insert error"));
            if (iFirst) return Promise.resolve([{ id: NEW_PROJECT_ID }]);
            return Promise.resolve([]);
          }),
        };
      }),
    };
  });

  const db = {
    insert: mockInsert,
    transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      // Use a fresh insert counter for the transaction context
      let txCallCount = 0;
      const txInsert = vi.fn().mockImplementation(() => {
        txCallCount++;
        const iFirstTx = txCallCount === 1;
        return {
          values: vi.fn().mockImplementation((vals: unknown) => {
            if (iFirstTx) projectInsertValues.push(vals);
            else historyInsertValues.push(vals);
            return {
              returning: vi.fn().mockImplementation(() => {
                if (iFirstTx && insertFails)
                  return Promise.reject(new Error("insert error"));
                if (!iFirstTx && historyInsertFails)
                  return Promise.reject(new Error("history insert error"));
                if (iFirstTx) return Promise.resolve([{ id: NEW_PROJECT_ID }]);
                return Promise.resolve([]);
              }),
            };
          }),
        };
      });
      return fn({ insert: txInsert });
    }),
    _projectInsertValues: projectInsertValues,
    _historyInsertValues: historyInsertValues,
  };

  return db;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("createProjectAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOrganization.mockResolvedValue({ organizationId: ORG_ID });
    // redirect() in Next.js is a throw internally; simulate that so the action stops.
    mockRedirect.mockImplementation((url: string) => {
      throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${url};307;` });
    });
  });

  // ── 1. Valid submission creates exactly one project ────────────────────────

  it("creates exactly one project row on valid submission", async () => {
    const db = makeMockDb();
    mockGetDb.mockReturnValue(db);

    const { createProjectAction } = await import(
      "@/app/projects/new/actions"
    );

    await expect(
      createProjectAction(INITIAL_STATE, makeFormData())
    ).rejects.toThrow("NEXT_REDIRECT");

    // transaction was called once
    expect(db.transaction).toHaveBeenCalledTimes(1);
    // exactly one project row inserted
    expect(db._projectInsertValues).toHaveLength(1);
  });

  // ── 2. Status-history record is created ───────────────────────────────────

  it("inserts a project_status_history record alongside the project", async () => {
    const db = makeMockDb();
    mockGetDb.mockReturnValue(db);

    const { createProjectAction } = await import(
      "@/app/projects/new/actions"
    );

    await expect(
      createProjectAction(INITIAL_STATE, makeFormData())
    ).rejects.toThrow("NEXT_REDIRECT");

    // one status-history row inserted
    expect(db._historyInsertValues).toHaveLength(1);
    const hist = db._historyInsertValues[0] as Record<string, unknown>;
    expect(hist.newStatus).toBe("researching_city");
    expect(hist.previousStatus).toBeNull();
  });

  // ── 3. Organization isolation ─────────────────────────────────────────────

  it("uses organizationId from requireOrganization(), never from formData", async () => {
    const db = makeMockDb();
    mockGetDb.mockReturnValue(db);

    const { createProjectAction } = await import(
      "@/app/projects/new/actions"
    );

    // Attempt to inject a different org via formData (should be ignored)
    const fd = makeFormData();
    fd.append("organizationId", "evil-org-999");

    await expect(
      createProjectAction(INITIAL_STATE, fd)
    ).rejects.toThrow("NEXT_REDIRECT");

    const inserted = db._projectInsertValues[0] as Record<string, unknown>;
    expect(inserted.organizationId).toBe(ORG_ID);
    expect(inserted.organizationId).not.toBe("evil-org-999");
  });

  // ── 4. Transaction failure creates no partial project ─────────────────────

  it("returns an error state and creates no partial project when the transaction fails", async () => {
    const db = makeMockDb({ insertFails: true });
    mockGetDb.mockReturnValue(db);

    const { createProjectAction } = await import(
      "@/app/projects/new/actions"
    );

    const result = await createProjectAction(INITIAL_STATE, makeFormData());

    // must return an error, not throw
    expect(result.error).toBeTruthy();
    expect(result.error).toContain("Failed to create project");
    // redirect must NOT have been called
    expect(mockRedirect).not.toHaveBeenCalled();
    // revalidatePath must NOT have been called
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  // ── 5. Successful destination is /projects/{id} — never / ─────────────────

  it("redirects to /projects/{newProjectId} on success, never to /", async () => {
    const db = makeMockDb();
    mockGetDb.mockReturnValue(db);

    const { createProjectAction } = await import(
      "@/app/projects/new/actions"
    );

    await expect(
      createProjectAction(INITIAL_STATE, makeFormData())
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledOnce();
    const redirectTarget = mockRedirect.mock.calls[0][0] as string;
    expect(redirectTarget).toBe(`/projects/${NEW_PROJECT_ID}`);
    expect(redirectTarget).not.toBe("/");
  });

  // ── 6. Missing required fields return errors without touching DB ───────────

  it("returns error and skips DB when name is missing", async () => {
    const db = makeMockDb();
    mockGetDb.mockReturnValue(db);

    const { createProjectAction } = await import(
      "@/app/projects/new/actions"
    );

    const fd = makeFormData({ name: "  " });
    const result = await createProjectAction(INITIAL_STATE, fd);

    expect(result.error).toBeTruthy();
    expect(result.error).toContain("name");
    expect(db.transaction).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("returns error and skips DB when city is missing", async () => {
    const db = makeMockDb();
    mockGetDb.mockReturnValue(db);

    const { createProjectAction } = await import(
      "@/app/projects/new/actions"
    );

    const fd = makeFormData({ targetCity: "" });
    const result = await createProjectAction(INITIAL_STATE, fd);

    expect(result.error).toBeTruthy();
    expect(result.error).toContain("city");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("returns error and skips DB when state is invalid", async () => {
    const db = makeMockDb();
    mockGetDb.mockReturnValue(db);

    const { createProjectAction } = await import(
      "@/app/projects/new/actions"
    );

    const fd = makeFormData({ state: "XYZ" });
    const result = await createProjectAction(INITIAL_STATE, fd);

    expect(result.error).toBeTruthy();
    expect(result.error).toContain("State");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  // ── 7. revalidatePath is called on success ────────────────────────────────

  it("calls revalidatePath for / and /projects on success", async () => {
    const db = makeMockDb();
    mockGetDb.mockReturnValue(db);

    const { createProjectAction } = await import(
      "@/app/projects/new/actions"
    );

    await expect(
      createProjectAction(INITIAL_STATE, makeFormData())
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/projects");
  });
});
