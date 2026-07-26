/**
 * Rate limiter unit tests.
 *
 * Tests:
 * - First N requests within window are allowed
 * - Request N+1 is denied
 * - A new scope key gets its own limit
 * - Different minute windows are independent
 * - resetInSeconds is between 0 and 60
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// We need to control time for window independence tests.
// The rate limiter uses Date internally, so we mock Date.

describe("checkRateLimit", () => {
  // Import freshly each test to avoid module-level store pollution
  // We re-import after each vi.setSystemTime to get a clean module state.

  beforeEach(() => {
    vi.useFakeTimers();
    // Reset to a known minute boundary: minute 100 (100 * 60000 ms)
    vi.setSystemTime(new Date(100 * 60000));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it("allows first request", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    const result = checkRateLimit("test-scope-a", 3);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("allows exactly N requests within the window", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    const scope = "test-scope-b";
    const max = 3;

    for (let i = 0; i < max; i++) {
      const r = checkRateLimit(scope, max);
      expect(r.allowed).toBe(true);
    }
  });

  it("denies request N+1 (exceeds limit)", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    const scope = "test-scope-c";
    const max = 3;

    // Exhaust the limit
    for (let i = 0; i < max; i++) {
      checkRateLimit(scope, max);
    }

    // Next one should be denied
    const denied = checkRateLimit(scope, max);
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
  });

  it("a new scope key gets its own independent limit", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    const max = 2;

    // Exhaust scope A
    checkRateLimit("scope-A", max);
    checkRateLimit("scope-A", max);
    const deniedA = checkRateLimit("scope-A", max);
    expect(deniedA.allowed).toBe(false);

    // Scope B should still be fresh
    const allowedB = checkRateLimit("scope-B", max);
    expect(allowedB.allowed).toBe(true);
  });

  it("different minute windows are independent", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    const scope = "test-scope-window";
    const max = 1;

    // Use the limit in minute 100
    vi.setSystemTime(new Date(100 * 60000 + 5000)); // 5s into minute 100
    const r1 = checkRateLimit(scope, max);
    expect(r1.allowed).toBe(true);

    const r2 = checkRateLimit(scope, max);
    expect(r2.allowed).toBe(false); // minute 100 exhausted

    // Advance to minute 101
    vi.setSystemTime(new Date(101 * 60000 + 5000)); // 5s into minute 101
    const r3 = checkRateLimit(scope, max);
    expect(r3.allowed).toBe(true); // fresh window
  });

  it("resetInSeconds is between 0 and 60", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    // Set to 30 seconds into the minute
    vi.setSystemTime(new Date(100 * 60000 + 30000));

    const r = checkRateLimit("reset-test-scope", 5);
    expect(r.resetInSeconds).toBeGreaterThanOrEqual(0);
    expect(r.resetInSeconds).toBeLessThanOrEqual(60);
  });

  it("remaining decrements with each allowed request", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    const scope = "decrement-test";
    const max = 4;

    const r1 = checkRateLimit(scope, max);
    expect(r1.remaining).toBe(3);

    const r2 = checkRateLimit(scope, max);
    expect(r2.remaining).toBe(2);

    const r3 = checkRateLimit(scope, max);
    expect(r3.remaining).toBe(1);

    const r4 = checkRateLimit(scope, max);
    expect(r4.remaining).toBe(0);
  });

  it("denied result has remaining=0", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    const scope = "deny-remaining-test";
    const max = 1;
    checkRateLimit(scope, max); // use up the 1 allowed
    const denied = checkRateLimit(scope, max);
    expect(denied.remaining).toBe(0);
    expect(denied.allowed).toBe(false);
  });
});
