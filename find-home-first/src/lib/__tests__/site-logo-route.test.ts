/**
 * Tests for GET /api/site-logo
 *
 * Verifies that the logo-serving endpoint:
 * 1.  Returns 302 → /images/fhf-logo.svg when no custom logo is configured
 * 2.  Returns 302 → /images/fhf-logo.svg when the setting exists but is disabled
 * 3.  Returns 302 → /images/fhf-logo.svg when the data URI is malformed
 * 4.  Returns 302 → /images/fhf-logo.svg when the content-type is not allowed
 * 5.  Returns 200 with correct Content-Type for a valid PNG data URI
 * 6.  Returns 200 with correct Content-Type for a valid JPEG data URI
 * 7.  Returns 200 with correct Content-Type for a valid SVG data URI
 * 8.  Returns 200 with correct Content-Type for a valid WebP data URI
 * 9.  Sets Cache-Control: no-cache on a successful response
 * 10. Sets Content-Length to the byte length of the image
 * 11. parseDataUri returns null for a non-data-URI string
 * 12. parseDataUri correctly extracts contentType and buffer
 * 13. Never returns raw image bytes when no logo is configured
 * 14. Returns 302 when getPlatformSetting throws (graceful fallback)
 */
import { describe, it, expect, vi, afterEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockGetPlatformSetting } = vi.hoisted(() => ({
  mockGetPlatformSetting: vi.fn(),
}));

vi.mock("@/lib/repository", () => ({
  getPlatformSetting: mockGetPlatformSetting,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDataUri(type: string, bytes: number): string {
  const buf = Buffer.from(new Uint8Array(bytes).fill(0xab));
  return `data:${type};base64,${buf.toString("base64")}`;
}

async function callGet() {
  // Re-import each time so mock state is fresh for the module
  const { GET } = await import("@/app/api/site-logo/route");
  return GET();
}

// ─── parseDataUri unit tests ──────────────────────────────────────────────────

describe("parseDataUri", () => {
  it("returns null for a plain string (not a data URI)", async () => {
    const { parseDataUri } = await import("@/app/api/site-logo/route");
    expect(parseDataUri("not-a-data-uri")).toBeNull();
  });

  it("returns null for an empty string", async () => {
    const { parseDataUri } = await import("@/app/api/site-logo/route");
    expect(parseDataUri("")).toBeNull();
  });

  it("correctly extracts contentType and buffer from a valid PNG data URI", async () => {
    const { parseDataUri } = await import("@/app/api/site-logo/route");
    const uri = makeDataUri("image/png", 4);
    const result = parseDataUri(uri);
    expect(result).not.toBeNull();
    expect(result!.contentType).toBe("image/png");
    expect(result!.buffer.byteLength).toBe(4);
  });

  it("correctly extracts contentType and buffer for SVG", async () => {
    const { parseDataUri } = await import("@/app/api/site-logo/route");
    const uri = makeDataUri("image/svg+xml", 8);
    const result = parseDataUri(uri);
    expect(result!.contentType).toBe("image/svg+xml");
    expect(result!.buffer.byteLength).toBe(8);
  });
});

// ─── GET /api/site-logo ───────────────────────────────────────────────────────

describe("GET /api/site-logo", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  // Test 1: no logo configured → redirect to default
  it("returns 302 to /images/fhf-logo.svg when no setting exists", async () => {
    mockGetPlatformSetting.mockResolvedValue(null);
    const res = await callGet();
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/images/fhf-logo.svg");
  });

  // Test 2: setting disabled → redirect to default
  it("returns 302 to /images/fhf-logo.svg when setting is disabled", async () => {
    mockGetPlatformSetting.mockResolvedValue({
      enabled: false,
      value: makeDataUri("image/png", 16),
    });
    const res = await callGet();
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/images/fhf-logo.svg");
  });

  // Test 3: malformed data URI → redirect to default
  it("returns 302 when the stored value is not a valid data URI", async () => {
    mockGetPlatformSetting.mockResolvedValue({
      enabled: true,
      value: "this-is-not-a-data-uri",
    });
    const res = await callGet();
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/images/fhf-logo.svg");
  });

  // Test 4: disallowed content type → redirect to default
  it("returns 302 when the stored content-type is not in the allowlist (e.g. image/gif)", async () => {
    mockGetPlatformSetting.mockResolvedValue({
      enabled: true,
      value: makeDataUri("image/gif", 8),
    });
    const res = await callGet();
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/images/fhf-logo.svg");
  });

  // Test 5: valid PNG → 200 with correct content-type
  it("returns 200 with Content-Type image/png for a saved PNG logo", async () => {
    mockGetPlatformSetting.mockResolvedValue({
      enabled: true,
      value: makeDataUri("image/png", 32),
    });
    const res = await callGet();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
  });

  // Test 6: valid JPEG → 200 with correct content-type
  it("returns 200 with Content-Type image/jpeg for a saved JPEG logo", async () => {
    mockGetPlatformSetting.mockResolvedValue({
      enabled: true,
      value: makeDataUri("image/jpeg", 32),
    });
    const res = await callGet();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
  });

  // Test 7: valid SVG → 200 with correct content-type
  it("returns 200 with Content-Type image/svg+xml for a saved SVG logo", async () => {
    mockGetPlatformSetting.mockResolvedValue({
      enabled: true,
      value: makeDataUri("image/svg+xml", 32),
    });
    const res = await callGet();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
  });

  // Test 8: valid WebP → 200 with correct content-type
  it("returns 200 with Content-Type image/webp for a saved WebP logo", async () => {
    mockGetPlatformSetting.mockResolvedValue({
      enabled: true,
      value: makeDataUri("image/webp", 32),
    });
    const res = await callGet();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
  });

  // Test 9: Cache-Control header present on successful response
  it("sets Cache-Control: no-cache on a 200 response", async () => {
    mockGetPlatformSetting.mockResolvedValue({
      enabled: true,
      value: makeDataUri("image/png", 16),
    });
    const res = await callGet();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toMatch(/no-cache/);
  });

  // Test 10: Content-Length matches image byte length
  it("sets Content-Length equal to the image byte length", async () => {
    const byteLength = 64;
    mockGetPlatformSetting.mockResolvedValue({
      enabled: true,
      value: makeDataUri("image/png", byteLength),
    });
    const res = await callGet();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Length")).toBe(String(byteLength));
  });

  // Test 13: no raw bytes returned when no logo configured
  it("does not return image bytes when no logo is configured", async () => {
    mockGetPlatformSetting.mockResolvedValue(null);
    const res = await callGet();
    // Should be a redirect — body is null/empty
    expect(res.status).toBe(302);
    const text = await res.text();
    expect(text).toBe("");
  });

  // Test 14: getPlatformSetting throws → graceful 302 fallback
  it("returns 302 to default when getPlatformSetting throws", async () => {
    mockGetPlatformSetting.mockRejectedValue(new Error("DB down"));
    const res = await callGet();
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/images/fhf-logo.svg");
  });
});
