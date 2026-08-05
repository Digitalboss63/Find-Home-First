/**
 * GET /api/admin/hud-connection
 *
 * Back-office only. Tests HUD User API connectivity.
 * Returns: connected, httpStatus, dataset, geography, reportingYear, testedAt.
 * Never returns or logs the HUD_TOKEN.
 *
 * Authorization: requireOrganization() → role must be "owner".
 */
export const runtime = "nodejs";

import { type NextRequest, NextResponse } from "next/server";
import { requireOrganization, requireRole } from "@/lib/auth";
import { testHudConnection } from "@/lib/market-intelligence/collectors/hud-connection-test";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_req: NextRequest): Promise<NextResponse> {
  let orgCtx: Awaited<ReturnType<typeof requireOrganization>>;
  try {
    orgCtx = await requireOrganization();
  } catch {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    await requireRole(orgCtx, "owner");
  } catch {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const result = await testHudConnection();

  // Ensure the token is never in the response
  return NextResponse.json({
    connected: result.connected,
    httpStatus: result.httpStatus,
    dataset: result.dataset,
    geography: result.geography,
    reportingYear: result.reportingYear,
    testedAt: result.testedAt,
    ...(result.error ? { error: result.error } : {}),
  });
}


