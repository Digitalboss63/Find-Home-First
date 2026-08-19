/**
 * GET /api/export/market-research/xlsx
 *
 * Query params:
 *   projectId  — UUID
 *   version    — positive integer
 *
 * Authorization:
 *   - requireOrganization() — org ID from Clerk session only
 *   - organizationId is NEVER accepted from query params, body, or headers
 *
 * Returns:
 *   200 application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
 *   400 — invalid params
 *   404 — not found (also returned for cross-org access)
 *   409 — report not complete or exceeds size limit
 *   500 — internal error (sanitized message only)
 *
 * Version behavior: same as PDF route. No silent version substitution.
 * Size limit: 10 MB raw report JSON. Generated xlsx may be larger; memory
 *   is bounded by ExcelJS streaming write.
 */

export const runtime = "nodejs";

import { type NextRequest, NextResponse } from "next/server";
import { requireOrganization } from "@/lib/auth";
import { projectBelongsToOrg } from "@/lib/repository";
import { getDb } from "@/db/client";
import { getReportByVersion } from "@/lib/repository-intelligence";
import { buildExcelWorkbook } from "@/lib/export/excel-workbook";
import { buildExportFilename, buildContentDisposition } from "@/lib/export/filename";
import type { MarketReportSnapshot } from "@/lib/export/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_REPORT_JSON_BYTES = 10 * 1024 * 1024; // 10 MB
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

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
  const belongs = await projectBelongsToOrg(projectId, organizationId);
  if (!belongs) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // ── Load exact report version ─────────────────────────────────────────────
  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }

  const reportRow = await getReportByVersion(db, organizationId, projectId, version);

  if (!reportRow) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (reportRow.status !== "complete" && reportRow.status !== "superseded") {
    return NextResponse.json(
      { error: `Report version ${version} is not complete (status: ${reportRow.status}). Export is unavailable until collection finishes successfully.` },
      { status: 409 }
    );
  }

  if (!reportRow.reportJson) {
    return NextResponse.json({ error: "Report data unavailable." }, { status: 409 });
  }

  if (Buffer.byteLength(reportRow.reportJson, "utf8") > MAX_REPORT_JSON_BYTES) {
    return NextResponse.json({ error: "Report exceeds maximum export size." }, { status: 409 });
  }

  let report: MarketReportSnapshot;
  try {
    report = JSON.parse(reportRow.reportJson) as MarketReportSnapshot;
  } catch {
    return NextResponse.json({ error: "Report data could not be read." }, { status: 500 });
  }

  // ── Generate workbook ─────────────────────────────────────────────────────
  const exportedAt = new Date().toISOString();
  let xlsxBuffer: Buffer;
  try {
    xlsxBuffer = await buildExcelWorkbook({ report, exportedAt });
  } catch {
    return NextResponse.json({ error: "Spreadsheet generation failed. Please try again." }, { status: 500 });
  }

  // ── Filename ──────────────────────────────────────────────────────────────
  const filename = buildExportFilename({
    city: report.geography.city,
    stateAbbr: report.geography.stateAbbr,
    targetPopulation: report.targetPopulation,
    version: report.version,
    generatedAt: report.generatedAt,
    format: "xlsx",
  });

  return new NextResponse(xlsxBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": buildContentDisposition(filename),
      "Content-Length": String(xlsxBuffer.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
