/**
 * GET /api/export/market-research/pdf
 *
 * Query params:
 *   projectId  — UUID
 *   version    — positive integer
 *
 * Authorization:
 *   - requireOrganization() — org ID from Clerk session only
 *   - projectBelongsToOrg verified using org ID from session
 *   - organizationId is NEVER accepted from query params, body, or headers
 *
 * Returns:
 *   200 application/pdf — attachment
 *   400 — invalid params
 *   404 — project or report not found (also returned for cross-org access)
 *   409 — report is not complete (generating, failed, or incomplete)
 *   500 — internal error (sanitized message only)
 *
 * Version behavior:
 *   - Exact requested version is loaded from the DB
 *   - If that version is not complete, returns 409 — never substitutes
 *   - No silent substitution of a different version
 *
 * Size limit: 10 MB. Reports exceeding this return 409.
 * Credentials and stack traces are never included in the response.
 */

export const runtime = "nodejs";

import { type NextRequest, NextResponse } from "next/server";
import { requireOrganization } from "@/lib/auth";
import { projectBelongsToOrg } from "@/lib/repository";
import { getDb } from "@/db/client";
import { buildReportDocument } from "@/lib/export/pdf-document";
import { buildExportFilename, buildContentDisposition } from "@/lib/export/filename";
import type { MarketReportSnapshot } from "@/lib/export/types";
import { renderToBuffer } from "@react-pdf/renderer";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_REPORT_JSON_BYTES = 10 * 1024 * 1024; // 10 MB

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  let orgCtx: Awaited<ReturnType<typeof requireOrganization>>;
  try {
    orgCtx = await requireOrganization();
  } catch {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const { organizationId } = orgCtx;

  // ── Params ────────────────────────────────────────────────────────────────
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? "";
  const versionRaw = searchParams.get("version") ?? "";

  if (!UUID_RE.test(projectId)) {
    return NextResponse.json({ error: "Invalid projectId." }, { status: 400 });
  }

  const version = parseInt(versionRaw, 10);
  if (!Number.isInteger(version) || version < 1 || String(version) !== versionRaw) {
    return NextResponse.json({ error: "version must be a positive integer." }, { status: 400 });
  }

  // ── Org ownership ─────────────────────────────────────────────────────────
  // Return 404 (not 403) to avoid confirming the existence of cross-org records.
  const belongs = await projectBelongsToOrg(projectId, organizationId);
  if (!belongs) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // ── Load exact report version ─────────────────────────────────────────────
  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }

  // TODO(market-intelligence): Replace this stub with a real DB query once the
  // market_research_reports table exists (added in the market intelligence phase).
  //
  //   const rows = await db.select({
  //     status: marketResearchReports.status,
  //     reportJson: marketResearchReports.reportJson,
  //   })
  //     .from(marketResearchReports)
  //     .where(and(
  //       eq(marketResearchReports.projectId, projectId),
  //       eq(marketResearchReports.organizationId, organizationId),
  //       eq(marketResearchReports.version, version),
  //     ))
  //     .limit(1);
  //   reportRow = rows[0] ?? null;
  //
  // Until then, the route correctly returns 404 for all requests (table not yet present).
  type ReportRow = { status: string; reportJson: string | null };
  const reportRow = null as ReportRow | null;

  if (!reportRow) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // ── Version completeness check ────────────────────────────────────────────
  if (reportRow.status !== "complete") {
    return NextResponse.json(
      { error: `Report version ${version} is not complete (status: ${reportRow.status}). Export is unavailable until collection finishes successfully.` },
      { status: 409 }
    );
  }

  if (!reportRow.reportJson) {
    return NextResponse.json({ error: "Report data unavailable." }, { status: 409 });
  }

  // ── Size check ────────────────────────────────────────────────────────────
  if (Buffer.byteLength(reportRow.reportJson, "utf8") > MAX_REPORT_JSON_BYTES) {
    return NextResponse.json({ error: "Report exceeds maximum export size." }, { status: 409 });
  }

  // ── Parse snapshot ────────────────────────────────────────────────────────
  let report: MarketReportSnapshot;
  try {
    report = JSON.parse(reportRow.reportJson) as MarketReportSnapshot;
  } catch {
    return NextResponse.json({ error: "Report data could not be read." }, { status: 500 });
  }

  // ── Generate PDF ──────────────────────────────────────────────────────────
  const exportedAt = new Date().toISOString();
  let pdfBuffer: Buffer;
  try {
    const doc = buildReportDocument({
      report,
      exportedAt,
      onlineReportUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.findhomefirst.com"}/projects/${report.projectId}`
    });
    // renderToBuffer expects ReactElement<DocumentProps>; the JSX return from
    // buildReportDocument satisfies this at runtime. Cast via unknown to satisfy
    // the TypeScript overload while keeping the actual type correct.
    pdfBuffer = await renderToBuffer(doc as unknown as Parameters<typeof renderToBuffer>[0]);
  } catch {
    // Intentionally not forwarding the internal error message
    return NextResponse.json({ error: "PDF generation failed. Please try again." }, { status: 500 });
  }

  // ── Filename ──────────────────────────────────────────────────────────────
  const filename = buildExportFilename({
    city: report.geography.city,
    stateAbbr: report.geography.stateAbbr,
    targetPopulation: report.targetPopulation,
    version: report.version,
    generatedAt: report.generatedAt,
    format: "pdf",
  });

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": buildContentDisposition(filename),
      "Content-Length": String(pdfBuffer.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
