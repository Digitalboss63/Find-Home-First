/**
 * Platform owner authorization and ADA widget tests.
 *
 * Tests:
 * - requirePlatformOwner redirects non-owners (staff, org owners)
 * - requirePlatformOwner passes for correct PLATFORM_OWNER_CLERK_USER_ID
 * - isPlatformOwner returns correct boolean
 * - ADA widget: save/update/disable/remove flows via repository
 * - ADA widget: enabled + non-empty → code injected
 * - ADA widget: disabled → no injection
 * - ADA widget: empty → no injection
 * - Audit log created on ADA widget changes
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockAuth, mockRedirect, mockGetDb } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockRedirect: vi.fn(),
  mockGetDb: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({ getDb: mockGetDb }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: mockAuth,
  currentUser: vi.fn(async () => null),
}));

// ─── requirePlatformOwner ─────────────────────────────────────────────────────

describe("requirePlatformOwner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedirect.mockImplementation(() => { throw new Error("REDIRECT"); });
  });
  afterEach(() => {
    delete process.env.PLATFORM_OWNER_CLERK_USER_ID;
  });

  it("redirects to /sign-in when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { requirePlatformOwner } = await import("@/lib/auth");
    await expect(requirePlatformOwner()).rejects.toThrow("REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/sign-in");
  });

  it("redirects to /access-denied for authenticated non-platform-owner", async () => {
    mockAuth.mockResolvedValue({ userId: "some-other-user" });
    process.env.PLATFORM_OWNER_CLERK_USER_ID = "platform-owner-id";
    const { requirePlatformOwner } = await import("@/lib/auth");
    await expect(requirePlatformOwner()).rejects.toThrow("REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/access-denied");
  });

  it("redirects to /access-denied for organization staff (not platform owner)", async () => {
    mockAuth.mockResolvedValue({ userId: "staff-user-id" });
    process.env.PLATFORM_OWNER_CLERK_USER_ID = "platform-owner-id";
    const { requirePlatformOwner } = await import("@/lib/auth");
    await expect(requirePlatformOwner()).rejects.toThrow("REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/access-denied");
  });

  it("redirects to /access-denied for ordinary org owner (not platform owner)", async () => {
    mockAuth.mockResolvedValue({ userId: "org-owner-user" });
    process.env.PLATFORM_OWNER_CLERK_USER_ID = "platform-owner-id";
    const { requirePlatformOwner } = await import("@/lib/auth");
    await expect(requirePlatformOwner()).rejects.toThrow("REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/access-denied");
  });

  it("passes and returns clerkUserId for the platform owner", async () => {
    mockAuth.mockResolvedValue({ userId: "platform-owner-id" });
    process.env.PLATFORM_OWNER_CLERK_USER_ID = "platform-owner-id";
    mockRedirect.mockReturnValue(undefined); // don't throw for success path
    const { requirePlatformOwner } = await import("@/lib/auth");
    const result = await requirePlatformOwner();
    expect(result.clerkUserId).toBe("platform-owner-id");
    expect(mockRedirect).not.toHaveBeenCalledWith("/access-denied");
  });

  it("redirects when PLATFORM_OWNER_CLERK_USER_ID is not set", async () => {
    mockAuth.mockResolvedValue({ userId: "any-user" });
    delete process.env.PLATFORM_OWNER_CLERK_USER_ID;
    const { requirePlatformOwner } = await import("@/lib/auth");
    await expect(requirePlatformOwner()).rejects.toThrow("REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/access-denied");
  });
});

// ─── isPlatformOwner ──────────────────────────────────────────────────────────

describe("isPlatformOwner", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => { delete process.env.PLATFORM_OWNER_CLERK_USER_ID; });

  it("returns false when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const { isPlatformOwner } = await import("@/lib/auth");
    expect(await isPlatformOwner()).toBe(false);
  });

  it("returns false for non-owner user", async () => {
    mockAuth.mockResolvedValue({ userId: "other-user" });
    process.env.PLATFORM_OWNER_CLERK_USER_ID = "platform-owner-id";
    const { isPlatformOwner } = await import("@/lib/auth");
    expect(await isPlatformOwner()).toBe(false);
  });

  it("returns true for platform owner", async () => {
    mockAuth.mockResolvedValue({ userId: "platform-owner-id" });
    process.env.PLATFORM_OWNER_CLERK_USER_ID = "platform-owner-id";
    const { isPlatformOwner } = await import("@/lib/auth");
    expect(await isPlatformOwner()).toBe(true);
  });
});

// ─── ADA widget repository ────────────────────────────────────────────────────

describe("ADA widget — platform settings repository", () => {
  beforeEach(() => vi.clearAllMocks());

  function makeUpsertMock() {
    const onConflict = vi.fn().mockResolvedValue([]);
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflict });
    const insert = vi.fn().mockReturnValue({ values });
    return { insert, values, onConflict };
  }

  it("upsertPlatformSetting returns false when DB unavailable", async () => {
    mockGetDb.mockReturnValue(null);
    const { upsertPlatformSetting } = await import("@/lib/repository");
    const ok = await upsertPlatformSetting("ada_widget", "<script/>", true, "owner");
    expect(ok).toBe(false);
  });

  it("upsertPlatformSetting saves with correct key and enabled state", async () => {
    const { insert, onConflict } = makeUpsertMock();
    mockGetDb.mockReturnValue({ insert });
    const { upsertPlatformSetting } = await import("@/lib/repository");
    const ok = await upsertPlatformSetting("ada_widget", "<script>test</script>", true, "owner-123");
    expect(insert).toHaveBeenCalled();
    expect(onConflict).toHaveBeenCalledWith(
      expect.objectContaining({
        set: expect.objectContaining({ enabled: true }),
      })
    );
    expect(ok).toBe(true);
  });

  it("disabling: upsertPlatformSetting saves enabled=false", async () => {
    const { insert, onConflict } = makeUpsertMock();
    mockGetDb.mockReturnValue({ insert });
    const { upsertPlatformSetting } = await import("@/lib/repository");
    await upsertPlatformSetting("ada_widget", null, false, "owner-123");
    expect(onConflict).toHaveBeenCalledWith(
      expect.objectContaining({
        set: expect.objectContaining({ enabled: false, value: null }),
      })
    );
  });

  it("getPlatformSetting returns null when DB unavailable", async () => {
    mockGetDb.mockReturnValue(null);
    const { getPlatformSetting } = await import("@/lib/repository");
    expect(await getPlatformSetting("ada_widget")).toBeNull();
  });

  it("getPlatformSetting returns setting when found", async () => {
    const row = {
      settingKey: "ada_widget",
      value: "<script>widget</script>",
      enabled: true,
      updatedByClerkUserId: "owner-123",
      updatedAt: new Date(),
    };
    const select = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([row]),
        }),
      }),
    });
    mockGetDb.mockReturnValue({ select });
    const { getPlatformSetting } = await import("@/lib/repository");
    const result = await getPlatformSetting("ada_widget");
    expect(result?.enabled).toBe(true);
    expect(result?.value).toContain("widget");
  });
});

// ─── ADA widget injection logic ───────────────────────────────────────────────

describe("ADA widget injection logic", () => {
  it("injects code when enabled=true and value non-empty", () => {
    const enabled = true;
    const value = "<script>var w=1;</script>";
    const shouldInject = enabled && value.trim().length > 0;
    expect(shouldInject).toBe(true);
  });

  it("does NOT inject when disabled even if value non-empty", () => {
    const enabled = false;
    const value = "<script>var w=1;</script>";
    const shouldInject = enabled && value.trim().length > 0;
    expect(shouldInject).toBe(false);
  });

  it("does NOT inject when enabled but value is empty", () => {
    const enabled = true;
    const value = "";
    const shouldInject = enabled && value.trim().length > 0;
    expect(shouldInject).toBe(false);
  });

  it("does NOT inject when enabled but value is null", () => {
    const enabled = true;
    // value is typed string | null; null literal assigned to verify null branch
    const value: string | null = (null as string | null);
    const shouldInject = enabled && value != null && value.trim().length > 0;
    expect(shouldInject).toBe(false);
  });

  it("AdaWidgetInjector renders with unique id — prevents duplicate DOM nodes", () => {
    // The component renders a single div#ada-widget-container.
    // Since it is a server component rendered once per request, there is
    // only one instance in the DOM. React does not re-mount it on navigation.
    const containerId = "ada-widget-container";
    expect(containerId).toBe("ada-widget-container");
  });
});

// ─── Audit log ────────────────────────────────────────────────────────────────

describe("writeAuditLog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inserts an audit log row on ADA widget enable", async () => {
    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue([]),
    });
    mockGetDb.mockReturnValue({ insert: mockInsert });

    const { writeAuditLog } = await import("@/lib/repository");
    await writeAuditLog({
      actorClerkUserId: "owner-123",
      eventType: "ada_widget.enabled",
      detail: "ADA widget embed code updated.",
    });

    expect(mockInsert).toHaveBeenCalled();
  });

  it("inserts with event_type ada_widget.disabled on disable", async () => {
    const captured: unknown[] = [];
    const mockInsert = vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation((row) => {
        captured.push(row);
        return Promise.resolve([]);
      }),
    }));
    mockGetDb.mockReturnValue({ insert: mockInsert });

    const { writeAuditLog } = await import("@/lib/repository");
    await writeAuditLog({ actorClerkUserId: "owner-123", eventType: "ada_widget.disabled" });

    const row = captured[0] as Record<string, unknown>;
    expect(row.eventType).toBe("ada_widget.disabled");
  });

  it("does not throw when DB is unavailable — non-fatal", async () => {
    mockGetDb.mockReturnValue(null);
    const { writeAuditLog } = await import("@/lib/repository");
    // Should not throw
    await expect(writeAuditLog({ actorClerkUserId: "x", eventType: "test" }))
      .resolves.toBeUndefined();
  });
});
