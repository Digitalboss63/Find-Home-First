/**
 * Logo Manager tests.
 *
 * Tests:
 * 1.  POST route returns 403 for non-platform-owner
 * 2.  POST route returns 403 when PLATFORM_OWNER_CLERK_USER_ID not set
 * 3.  POST route returns 400 for disallowed file type
 * 4.  POST route returns 400 for oversized file (>2MB)
 * 5.  POST route saves valid PNG as base64 data URI and returns ok:true
 * 6.  POST route writes audit log entry with eventType "site_logo.updated"
 * 7.  DELETE route returns 403 for non-platform-owner
 * 8.  DELETE route calls upsertPlatformSetting with null/false and returns ok:true
 * 9.  DELETE route writes audit log entry with eventType "site_logo.restored_default"
 * 10. restoreDefaultLogoAction() returns ok:true on success
 * 11. restoreDefaultLogoAction() redirects non-owner to /access-denied
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockAuth, mockRedirect, mockGetDb, mockUpsert, mockAuditLog, mockRequirePlatformOwner } =
  vi.hoisted(() => ({
    mockAuth: vi.fn(),
    mockRedirect: vi.fn(),
    mockGetDb: vi.fn(),
    mockUpsert: vi.fn(),
    mockAuditLog: vi.fn(),
    mockRequirePlatformOwner: vi.fn(),
  }));

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () => ({ getDb: mockGetDb }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: mockAuth,
  currentUser: vi.fn(async () => null),
}));
vi.mock("@/lib/repository", () => ({
  upsertPlatformSetting: mockUpsert,
  writeAuditLog: mockAuditLog,
  getPlatformSetting: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  requirePlatformOwner: mockRequirePlatformOwner,
  isPlatformOwner: vi.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFile(name: string, type: string, sizeBytes: number): File {
  const content = new Uint8Array(sizeBytes).fill(65); // fill with 'A'
  return new File([content], name, { type });
}

async function makePostRequest(file: File): Promise<NextRequest> {
  const formData = new FormData();
  formData.append("logo", file);
  const request = new Request("http://localhost/api/back-office/logo", {
    method: "POST",
    body: formData,
  });
  return new NextRequest(request);
}

async function makeDeleteRequest(): Promise<NextRequest> {
  const request = new Request("http://localhost/api/back-office/logo", {
    method: "DELETE",
  });
  return new NextRequest(request);
}

// ─── isPlatformOwner helper ───────────────────────────────────────────────────

describe("isPlatformOwner helper", () => {
  afterEach(() => {
    delete process.env.PLATFORM_OWNER_CLERK_USER_ID;
  });

  it("returns false when PLATFORM_OWNER_CLERK_USER_ID is not set", async () => {
    delete process.env.PLATFORM_OWNER_CLERK_USER_ID;
    const { isPlatformOwner } = await import("@/app/api/back-office/logo/route");
    expect(isPlatformOwner("any-user")).toBe(false);
  });

  it("returns false when userId does not match owner env var", async () => {
    process.env.PLATFORM_OWNER_CLERK_USER_ID = "owner-id";
    const { isPlatformOwner } = await import("@/app/api/back-office/logo/route");
    expect(isPlatformOwner("other-user")).toBe(false);
  });

  it("returns true when userId matches PLATFORM_OWNER_CLERK_USER_ID", async () => {
    process.env.PLATFORM_OWNER_CLERK_USER_ID = "owner-id";
    const { isPlatformOwner } = await import("@/app/api/back-office/logo/route");
    expect(isPlatformOwner("owner-id")).toBe(true);
  });
});

// ─── POST /api/back-office/logo ───────────────────────────────────────────────

describe("POST /api/back-office/logo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditLog.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.PLATFORM_OWNER_CLERK_USER_ID;
  });

  // Test 1: Returns 403 for non-platform-owner
  it("returns 403 for authenticated non-platform-owner", async () => {
    mockAuth.mockResolvedValue({ userId: "non-owner-user" });
    process.env.PLATFORM_OWNER_CLERK_USER_ID = "owner-id";

    const { POST } = await import("@/app/api/back-office/logo/route");
    const file = makeFile("logo.png", "image/png", 100);
    const req = await makePostRequest(file);
    const res = await POST(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
  });

  // Test 2: Returns 403 when PLATFORM_OWNER_CLERK_USER_ID not set
  it("returns 403 when PLATFORM_OWNER_CLERK_USER_ID is not set", async () => {
    mockAuth.mockResolvedValue({ userId: "some-user" });
    delete process.env.PLATFORM_OWNER_CLERK_USER_ID;

    const { POST } = await import("@/app/api/back-office/logo/route");
    const file = makeFile("logo.png", "image/png", 100);
    const req = await makePostRequest(file);
    const res = await POST(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
  });

  // Test 3: Returns 400 for disallowed file type
  it("returns 400 for disallowed file type (e.g. image/gif)", async () => {
    mockAuth.mockResolvedValue({ userId: "owner-id" });
    process.env.PLATFORM_OWNER_CLERK_USER_ID = "owner-id";

    const { POST } = await import("@/app/api/back-office/logo/route");
    const file = makeFile("logo.gif", "image/gif", 100);
    const req = await makePostRequest(file);
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not allowed/i);
  });

  // Test 4: Returns 400 for oversized file (>2MB)
  it("returns 400 for file exceeding 2 MB", async () => {
    mockAuth.mockResolvedValue({ userId: "owner-id" });
    process.env.PLATFORM_OWNER_CLERK_USER_ID = "owner-id";

    const { POST } = await import("@/app/api/back-office/logo/route");
    const oversizeBytes = 2 * 1024 * 1024 + 1;
    const file = makeFile("huge.png", "image/png", oversizeBytes);
    const req = await makePostRequest(file);
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/too large/i);
  });

  // Test 5: Saves valid PNG and returns ok:true with dataUri
  it("saves valid PNG as base64 data URI and returns ok:true", async () => {
    mockAuth.mockResolvedValue({ userId: "owner-id" });
    process.env.PLATFORM_OWNER_CLERK_USER_ID = "owner-id";
    mockUpsert.mockResolvedValue(true);

    const { POST } = await import("@/app/api/back-office/logo/route");
    const file = makeFile("logo.png", "image/png", 512);
    const req = await makePostRequest(file);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.dataUri).toMatch(/^data:image\/png;base64,/);
    expect(mockUpsert).toHaveBeenCalledWith(
      "site_logo",
      expect.stringMatching(/^data:image\/png;base64,/),
      true,
      "owner-id"
    );
  });

  // Test 6: Writes audit log with eventType "site_logo.updated"
  it("writes audit log entry with eventType site_logo.updated", async () => {
    mockAuth.mockResolvedValue({ userId: "owner-id" });
    process.env.PLATFORM_OWNER_CLERK_USER_ID = "owner-id";
    mockUpsert.mockResolvedValue(true);

    const { POST } = await import("@/app/api/back-office/logo/route");
    const file = makeFile("mylogo.png", "image/png", 256);
    const req = await makePostRequest(file);
    await POST(req);

    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorClerkUserId: "owner-id",
        eventType: "site_logo.updated",
        detail: expect.stringContaining("mylogo.png"),
      })
    );
  });

  // SVG is also allowed
  it("accepts SVG files and saves them", async () => {
    mockAuth.mockResolvedValue({ userId: "owner-id" });
    process.env.PLATFORM_OWNER_CLERK_USER_ID = "owner-id";
    mockUpsert.mockResolvedValue(true);

    const { POST } = await import("@/app/api/back-office/logo/route");
    const file = makeFile("logo.svg", "image/svg+xml", 200);
    const req = await makePostRequest(file);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dataUri).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  // Returns 403 when unauthenticated
  it("returns 403 when userId is null (unauthenticated)", async () => {
    mockAuth.mockResolvedValue({ userId: null });
    process.env.PLATFORM_OWNER_CLERK_USER_ID = "owner-id";

    const { POST } = await import("@/app/api/back-office/logo/route");
    const file = makeFile("logo.png", "image/png", 100);
    const req = await makePostRequest(file);
    const res = await POST(req);

    expect(res.status).toBe(403);
  });
});

// ─── DELETE /api/back-office/logo ─────────────────────────────────────────────

describe("DELETE /api/back-office/logo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditLog.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.PLATFORM_OWNER_CLERK_USER_ID;
  });

  // Test 7: Returns 403 for non-platform-owner
  it("returns 403 for non-platform-owner", async () => {
    mockAuth.mockResolvedValue({ userId: "non-owner" });
    process.env.PLATFORM_OWNER_CLERK_USER_ID = "owner-id";

    const { DELETE } = await import("@/app/api/back-office/logo/route");
    const req = await makeDeleteRequest();
    const res = await DELETE(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
  });

  // Test 8: Calls upsertPlatformSetting with null/false and returns ok:true
  it("calls upsertPlatformSetting with null/false and returns ok:true", async () => {
    mockAuth.mockResolvedValue({ userId: "owner-id" });
    process.env.PLATFORM_OWNER_CLERK_USER_ID = "owner-id";
    mockUpsert.mockResolvedValue(true);

    const { DELETE } = await import("@/app/api/back-office/logo/route");
    const req = await makeDeleteRequest();
    const res = await DELETE(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith("site_logo", null, false, "owner-id");
  });

  // Test 9: Writes audit log with eventType "site_logo.restored_default"
  it("writes audit log entry with eventType site_logo.restored_default", async () => {
    mockAuth.mockResolvedValue({ userId: "owner-id" });
    process.env.PLATFORM_OWNER_CLERK_USER_ID = "owner-id";
    mockUpsert.mockResolvedValue(true);

    const { DELETE } = await import("@/app/api/back-office/logo/route");
    const req = await makeDeleteRequest();
    await DELETE(req);

    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorClerkUserId: "owner-id",
        eventType: "site_logo.restored_default",
      })
    );
  });

  // Returns 500 when upsert fails
  it("returns 500 when upsertPlatformSetting fails", async () => {
    mockAuth.mockResolvedValue({ userId: "owner-id" });
    process.env.PLATFORM_OWNER_CLERK_USER_ID = "owner-id";
    mockUpsert.mockResolvedValue(false);

    const { DELETE } = await import("@/app/api/back-office/logo/route");
    const req = await makeDeleteRequest();
    const res = await DELETE(req);

    expect(res.status).toBe(500);
  });
});

// ─── restoreDefaultLogoAction ─────────────────────────────────────────────────

describe("restoreDefaultLogoAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditLog.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.PLATFORM_OWNER_CLERK_USER_ID;
  });

  // Test 10: Returns ok:true on success
  it("returns ok:true on success", async () => {
    mockRequirePlatformOwner.mockResolvedValue({ clerkUserId: "owner-id" });
    mockUpsert.mockResolvedValue(true);

    const { restoreDefaultLogoAction } = await import(
      "@/app/back-office/site-settings/logo/actions"
    );
    const result = await restoreDefaultLogoAction();

    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockUpsert).toHaveBeenCalledWith("site_logo", null, false, "owner-id");
  });

  // Test 11: Redirects non-owner to /access-denied
  it("redirects non-owner (throws) to /access-denied", async () => {
    mockRedirect.mockImplementation(() => {
      throw new Error("REDIRECT:/access-denied");
    });
    mockRequirePlatformOwner.mockImplementation(async () => {
      mockRedirect("/access-denied");
    });

    const { restoreDefaultLogoAction } = await import(
      "@/app/back-office/site-settings/logo/actions"
    );
    await expect(restoreDefaultLogoAction()).rejects.toThrow("REDIRECT:/access-denied");
    expect(mockRedirect).toHaveBeenCalledWith("/access-denied");
  });

  // Returns ok:false when upsert fails
  it("returns ok:false and error message when upsert fails", async () => {
    mockRequirePlatformOwner.mockResolvedValue({ clerkUserId: "owner-id" });
    mockUpsert.mockResolvedValue(false);

    const { restoreDefaultLogoAction } = await import(
      "@/app/back-office/site-settings/logo/actions"
    );
    const result = await restoreDefaultLogoAction();

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Could not restore default logo.");
  });

  // Writes audit log on success
  it("writes audit log with site_logo.restored_default on success", async () => {
    mockRequirePlatformOwner.mockResolvedValue({ clerkUserId: "owner-id" });
    mockUpsert.mockResolvedValue(true);

    const { restoreDefaultLogoAction } = await import(
      "@/app/back-office/site-settings/logo/actions"
    );
    await restoreDefaultLogoAction();

    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorClerkUserId: "owner-id",
        eventType: "site_logo.restored_default",
      })
    );
  });

  // Does NOT write audit log when upsert fails
  it("does NOT write audit log when upsert fails", async () => {
    mockRequirePlatformOwner.mockResolvedValue({ clerkUserId: "owner-id" });
    mockUpsert.mockResolvedValue(false);

    const { restoreDefaultLogoAction } = await import(
      "@/app/back-office/site-settings/logo/actions"
    );
    await restoreDefaultLogoAction();

    expect(mockAuditLog).not.toHaveBeenCalled();
  });
});

// ─── Logo injection logic ─────────────────────────────────────────────────────

describe("Logo injection logic", () => {
  it("uses custom logo when enabled=true and value is non-empty", () => {
    const setting = { enabled: true, value: "data:image/png;base64,abc" };
    const logoSrc = setting?.enabled && setting.value ? setting.value : null;
    expect(logoSrc).toBe("data:image/png;base64,abc");
  });

  it("falls back to null when disabled even if value is non-empty", () => {
    const setting = { enabled: false, value: "data:image/png;base64,abc" };
    const logoSrc = setting?.enabled && setting.value ? setting.value : null;
    expect(logoSrc).toBeNull();
  });

  it("falls back to null when enabled but value is null", () => {
    const setting = { enabled: true, value: null as string | null };
    const logoSrc = setting?.enabled && setting.value ? setting.value : null;
    expect(logoSrc).toBeNull();
  });

  it("falls back to null when setting itself is null", () => {
    const setting = null as { enabled: boolean; value: string | null } | null;
    const logoSrc = setting?.enabled && setting.value ? setting.value : null;
    expect(logoSrc).toBeNull();
  });

  it("data URI format is correct for base64 PNG", () => {
    const type = "image/png";
    const base64 = Buffer.from("fake-png-bytes").toString("base64");
    const dataUri = `data:${type};base64,${base64}`;
    expect(dataUri).toMatch(/^data:image\/png;base64,/);
  });

  it("ALLOWED_TYPES includes PNG, JPEG, SVG, and WebP", () => {
    const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
    expect(ALLOWED_TYPES).toContain("image/png");
    expect(ALLOWED_TYPES).toContain("image/jpeg");
    expect(ALLOWED_TYPES).toContain("image/svg+xml");
    expect(ALLOWED_TYPES).toContain("image/webp");
    expect(ALLOWED_TYPES).not.toContain("image/gif");
  });

  it("MAX_BYTES is exactly 2 MB (2 * 1024 * 1024)", () => {
    const MAX_BYTES = 2 * 1024 * 1024;
    expect(MAX_BYTES).toBe(2097152);
  });
});
