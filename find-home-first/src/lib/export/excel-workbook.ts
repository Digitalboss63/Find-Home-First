/**
 * Excel workbook builder — exceljs
 *
 * Server-only. Never import in client components.
 *
 * Produces a real .xlsx workbook with seven worksheets.
 * All values come from the frozen MarketReportSnapshot — never regenerated.
 *
 * Formatting:
 *   - Bold frozen header rows with autofilters on data tables
 *   - Wrapped text throughout
 *   - Currency format: $#,##0.00
 *   - Percentage format: 0.0%
 *   - Integer score format: 0
 *   - Clickable source URLs via hyperlink cells
 *   - No merged cells inside any data table
 *   - Print areas and orientation configured
 *   - Unknown values: "Not Verified" — never 0 or blank
 *   - No API keys, stack traces, or org IDs in any cell
 */

import ExcelJS from "exceljs";
import type { ExportInput, ScorecardCategory, DemographicMetric, ProgramOpportunity, EconomicsScenario, Barrier, ReportSource } from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND_PRIMARY = "FF173F5F";
const BRAND_SECONDARY = "FF2F6F68";
const BRAND_SOFT = "FFE8F1EE";
const BRAND_WARNING = "FF7C2D12";
const BRAND_MUTED = "FF5C6773";
const WHITE = "FFFFFFFF";
const LIGHT_BORDER = "FFCBD5D8";

const NV = "Not Verified";

function nv(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return NV;
  return String(val);
}

function nvNum(val: number | null | undefined): number | string {
  if (val === null || val === undefined) return NV;
  return val;
}

function fmtPctDisplay(val: number | null | undefined): string {
  if (val === null || val === undefined) return NV;
  return `${(val * 100).toFixed(1)}%`;
}

// ─── Style helpers ────────────────────────────────────────────────────────────

function headerFill(): ExcelJS.FillPattern {
  return { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_PRIMARY } };
}

function softFill(): ExcelJS.FillPattern {
  return { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_SOFT } };
}

function headerFont(): Partial<ExcelJS.Font> {
  return { bold: true, color: { argb: WHITE }, size: 10 };
}

function bodyFont(): Partial<ExcelJS.Font> {
  return { size: 10 };
}

function boldFont(): Partial<ExcelJS.Font> {
  return { bold: true, size: 10 };
}

function warnFont(): Partial<ExcelJS.Font> {
  return { bold: true, color: { argb: BRAND_WARNING }, size: 10 };
}

function wrapAlignment(): Partial<ExcelJS.Alignment> {
  return { wrapText: true, vertical: "top" };
}

function applyHeaderRow(row: ExcelJS.Row, colCount: number): void {
  row.font = headerFont();
  row.fill = headerFill();
  row.alignment = wrapAlignment();
  row.height = 24;
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.border = {
      bottom: { style: "thin", color: { argb: LIGHT_BORDER } },
    };
  }
}

function applyDataRow(row: ExcelJS.Row, colCount: number, alt: boolean): void {
  if (alt) row.fill = softFill();
  row.font = bodyFont();
  row.alignment = wrapAlignment();
  row.height = 32;
  for (let c = 1; c <= colCount; c++) {
    row.getCell(c).border = {
      bottom: { style: "hair", color: { argb: LIGHT_BORDER } },
    };
  }
}

function setColumnWidths(ws: ExcelJS.Worksheet, widths: number[]): void {
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
}

function freezeFirstRow(ws: ExcelJS.Worksheet): void {
  ws.views = [{ state: "frozen", ySplit: 1, activeCell: "A2" }];
}

function addAutoFilter(ws: ExcelJS.Worksheet, lastCol: string): void {
  ws.autoFilter = `A1:${lastCol}1`;
}

// ─── Sheet 1 — Executive Summary ─────────────────────────────────────────────

function buildSummarySheet(wb: ExcelJS.Workbook, input: ExportInput): void {
  const { report, exportedAt } = input;
  const ws = wb.addWorksheet("Executive Summary");

  ws.pageSetup = { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 2 };
  setColumnWidths(ws, [28, 60]);

  // Title block
  const titleRow = ws.addRow(["Find Home First — City Demographic & Opportunity Report"]);
  titleRow.font = { bold: true, size: 14, color: { argb: BRAND_PRIMARY } };
  titleRow.height = 30;
  ws.mergeCells("A1:B1");

  ws.addRow([]);

  const rows: [string, string][] = [
    ["Project", nv(report.projectName)],
    ["Market", `${report.geography.city}, ${report.geography.stateAbbr}`],
    ["Target Population", nv(report.targetPopulation)],
    ["Verdict", nv(report.verdict)],
    ["Overall Score", report.overallScore != null ? String(report.overallScore) + " / 100" : NV],
    ["Confidence", nv(report.confidence)],
    ["Best Program Opportunity", nv(report.bestProgramOpportunity)],
    ["Largest Blocker", nv(report.largestBlocker)],
    ["Recommended Next Action", nv(report.primaryNextAction)],
    ["Report ID", nv(report.reportId)],
    ["Version", `v${report.version}`],
    ["Generated", new Date(report.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })],
    ["Data Through", nv(report.dataThroughDate)],
    ["Exported", new Date(exportedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })],
  ];

  rows.forEach(([label, value], idx) => {
    const row = ws.addRow([label, value]);
    row.getCell(1).font = boldFont();
    row.getCell(1).fill = softFill();
    row.getCell(2).font = bodyFont();
    row.getCell(2).alignment = wrapAlignment();
    row.height = 22;
    if (idx === 3) { // Verdict row — highlight
      row.getCell(2).font = { bold: true, size: 11, color: { argb: BRAND_PRIMARY } };
    }
  });

  ws.addRow([]);
  const disclaimer = ws.addRow(["Disclaimer", "This report is decision support only. It does not guarantee program approval, referral partnerships, payment amounts, or property compliance."]);
  disclaimer.getCell(1).font = boldFont();
  disclaimer.getCell(2).font = { italic: true, size: 9, color: { argb: BRAND_MUTED } };
  disclaimer.getCell(2).alignment = wrapAlignment();
  disclaimer.height = 40;
}

// ─── Sheet 2 — Opportunity Scorecard ─────────────────────────────────────────

function buildScorecardSheet(wb: ExcelJS.Workbook, input: ExportInput): void {
  const { report } = input;
  const ws = wb.addWorksheet("Opportunity Scorecard");
  const cols = ["Category", "Numeric Score", "Display Band", "Weight", "Weighted Contribution", "Key Reason", "Missing Evidence"];

  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1 };
  setColumnWidths(ws, [22, 14, 14, 10, 20, 50, 40]);
  freezeFirstRow(ws);

  const headerRow = ws.addRow(cols);
  applyHeaderRow(headerRow, cols.length);
  addAutoFilter(ws, "G");

  report.scorecard.slice(0, 5).forEach((cat: ScorecardCategory, i: number) => {
    const row = ws.addRow([
      cat.label,
      cat.numericScore ?? NV,
      cat.band,
      cat.weight,
      cat.weightedContribution ?? NV,
      cat.reason,
      cat.missingEvidence ?? "—",
    ]);
    applyDataRow(row, cols.length, i % 2 === 1);
    // Numeric score: integer format
    if (cat.numericScore != null) row.getCell(2).numFmt = "0";
    // Weight: percentage
    if (typeof row.getCell(4).value === "number") row.getCell(4).numFmt = "0%";
    // Contribution: decimal
    if (typeof row.getCell(5).value === "number") row.getCell(5).numFmt = "0.00";
    // Missing evidence: warning color
    if (cat.missingEvidence) row.getCell(7).font = warnFont();
  });

  // Footer: formula explanation
  ws.addRow([]);
  const note = ws.addRow(["Formula", "Composite = (Housing Need × 25%) + (Program Fit × 25%) + (Property Availability × 25%) + (Referral Readiness × 15%) + ((100 − Operating Risk) × 10%). Operating risk is inverted. Scores 0–100; High ≥ 70, Medium 40–69, Low < 40. Unknown = critical data unavailable."]);
  note.getCell(1).font = boldFont();
  note.getCell(2).font = { italic: true, size: 9, color: { argb: BRAND_MUTED } };
  note.getCell(2).alignment = wrapAlignment();
  note.height = 40;
}

// ─── Sheet 3 — Demographics ───────────────────────────────────────────────────

function buildDemographicsSheet(wb: ExcelJS.Workbook, input: ExportInput): void {
  const { report } = input;
  const ws = wb.addWorksheet("Demographics");
  const cols = ["Metric", "Value", "Unit", "Percentage", "Comparison Population", "Reporting Period", "Geography", "Confidence", "Reported or Derived", "Source", "Calculation Method"];

  ws.pageSetup = { orientation: "landscape", fitToPage: true };
  setColumnWidths(ws, [30, 14, 12, 14, 35, 20, 30, 12, 16, 18, 40]);
  freezeFirstRow(ws);

  const headerRow = ws.addRow(cols);
  applyHeaderRow(headerRow, cols.length);
  addAutoFilter(ws, "K");

  const allMetrics = report.primaryDemographics.concat(report.allDemographics);
  allMetrics.forEach((d: DemographicMetric, i: number) => {
    const row = ws.addRow([
      d.label + (d.isDerived ? " (Derived)" : ""),
      d.numericValue ?? NV,
      d.unit,
      d.percentage != null ? d.percentage : NV,
      nv(d.comparisonPopulation),
      d.reportingPeriod,
      d.geographyName,
      d.confidence,
      d.isDerived ? "Derived" : "Reported",
      d.sourceKey,
      nv(d.calculationMethod),
    ]);
    applyDataRow(row, cols.length, i % 2 === 1);
    if (typeof row.getCell(2).value === "number") row.getCell(2).numFmt = "#,##0";
    if (typeof row.getCell(4).value === "number") row.getCell(4).numFmt = "0.0%";
    if (d.numericValue === null) row.getCell(2).font = warnFont();
    if (d.isDerived) row.getCell(9).font = { italic: true, size: 10 };
  });
}

// ─── Sheet 4 — Programs ───────────────────────────────────────────────────────

function buildProgramsSheet(wb: ExcelJS.Workbook, input: ExportInput): void {
  const { report } = input;
  const ws = wb.addWorksheet("Programs");
  const cols = [
    "Program", "Fit Rank", "Population Served", "Assistance", "Find Home First Role",
    "Shared-Housing Compatibility", "Lease Requirements", "Inspection Requirements",
    "Local Provider", "Availability", "Unresolved Restrictions", "Source / Date",
  ];

  ws.pageSetup = { orientation: "landscape", fitToPage: true };
  setColumnWidths(ws, [22, 18, 22, 28, 28, 30, 22, 22, 22, 22, 30, 20]);
  freezeFirstRow(ws);

  const headerRow = ws.addRow(cols);
  applyHeaderRow(headerRow, cols.length);
  addAutoFilter(ws, "L");

  report.programs.forEach((p: ProgramOpportunity, i: number) => {
    const row = ws.addRow([
      p.programName,
      p.fitRank,
      p.populationServed,
      p.assistanceAvailable,
      p.findHomeFirstRole,
      p.sharedHousingCompatibility,
      p.leaseRequirements ?? NV,
      p.inspectionRequirements ?? NV,
      p.localAdminOrg ?? NV,
      p.currentAvailability,
      p.unresolvedRestrictions ?? "—",
      `${p.sourceKey} · ${p.reportingDate}`,
    ]);
    applyDataRow(row, cols.length, i % 2 === 1);
    // Not Verified cells: warning
    [7, 8, 9].forEach((col) => {
      if (row.getCell(col).value === NV) row.getCell(col).font = warnFont();
    });
  });
}

// ─── Sheet 5 — Property Economics ────────────────────────────────────────────

function buildEconomicsSheet(wb: ExcelJS.Workbook, input: ExportInput): void {
  const { report } = input;
  const ws = wb.addWorksheet("Property Economics");
  const cols = [
    "Scenario", "Occupancy %", "Usable Rooms", "Expected Occupied Rooms",
    "Revenue", "Property Rent", "Utilities", "Prep/Furnishing",
    "Insurance", "Maintenance", "Vacancy Allowance", "Other Costs",
    "Net Margin", "Break-Even Occupancy %", "Assumption Status",
  ];

  ws.pageSetup = { orientation: "landscape", fitToPage: true };
  setColumnWidths(ws, [14, 12, 14, 22, 14, 14, 12, 16, 12, 14, 18, 14, 14, 22, 18]);
  freezeFirstRow(ws);

  const headerRow = ws.addRow(cols);
  applyHeaderRow(headerRow, cols.length);

  // FMR benchmarks above table
  ws.insertRow(1, ["FMR Benchmarks (FY2026 — market benchmark only, NOT guaranteed revenue)"]);
  ws.getRow(1).font = { bold: true, size: 10, color: { argb: BRAND_WARNING } };
  ws.getRow(1).height = 22;

  report.fmrBenchmarks.forEach((b) => {
    const row = ws.addRow([b.label, b.usd, "", "", "", "", "", "", "", "", "", "", "", "", ""]);
    row.getCell(1).font = boldFont();
    row.getCell(2).numFmt = "$#,##0";
    row.height = 18;
  });

  ws.addRow([]);

  const dataHeaderRow = ws.addRow(cols);
  applyHeaderRow(dataHeaderRow, cols.length);
  freezeFirstRow(ws); // re-apply to adjusted position — visually freezes the scenario header

  report.economicsScenarios.forEach((sc: EconomicsScenario, i: number) => {
    const row = ws.addRow([
      sc.label,
      sc.occupancyPct,
      sc.usableRooms,
      sc.expectedOccupiedRooms,
      nvNum(sc.revenueUsd),
      nvNum(sc.propertyRentUsd),
      nvNum(sc.utilitiesUsd),
      nvNum(sc.prepFurnishingUsd),
      nvNum(sc.insuranceUsd),
      nvNum(sc.maintenanceUsd),
      nvNum(sc.vacancyAllowanceUsd),
      nvNum(sc.otherCostsUsd),
      nvNum(sc.netMarginUsd),
      nvNum(sc.breakEvenOccupancyPct),
      sc.assumptionStatus,
    ]);
    applyDataRow(row, cols.length, i % 2 === 1);
    [2, 14].forEach((c) => { if (typeof row.getCell(c).value === "number") row.getCell(c).numFmt = "0.0%"; });
    [5, 6, 7, 8, 9, 10, 11, 12, 13].forEach((c) => { if (typeof row.getCell(c).value === "number") row.getCell(c).numFmt = "$#,##0.00"; });
    [5, 6, 7, 8, 9, 10, 11, 12, 13].forEach((c) => { if (row.getCell(c).value === NV) row.getCell(c).font = warnFont(); });
    if (sc.assumptionStatus === "Not Verified") row.getCell(15).font = warnFont();
  });

  ws.addRow([]);
  const note = ws.addRow(["Formula", "Revenue = Payment per room × Expected occupied rooms. Net Margin = Revenue − Rent − Utilities − Prep − Insurance − Maintenance − Vacancy − Other. Break-even = the occupancy % at which Net Margin = 0."]);
  note.getCell(1).font = boldFont();
  note.getCell(2).font = { italic: true, size: 9, color: { argb: BRAND_MUTED } };
  note.getCell(2).alignment = wrapAlignment();
  note.height = 40;

  ws.addRow([]);
  ws.addRow([report.economicsConclusion]);
  const concRow = ws.lastRow!;
  concRow.getCell(1).font = { italic: true, size: 10, color: { argb: BRAND_MUTED } };
  concRow.height = 36;
}

// ─── Sheet 6 — Barriers and Actions ──────────────────────────────────────────

function buildBarriersSheet(wb: ExcelJS.Workbook, input: ExportInput): void {
  const { report } = input;
  const ws = wb.addWorksheet("Barriers and Actions");
  const cols = ["Barrier", "Why It Matters", "Severity", "Verification Status", "Responsible Party", "Resolution Action", "Blocks Approval"];

  ws.pageSetup = { orientation: "landscape", fitToPage: true };
  setColumnWidths(ws, [30, 40, 12, 18, 28, 40, 16]);
  freezeFirstRow(ws);

  const headerRow = ws.addRow(cols);
  applyHeaderRow(headerRow, cols.length);
  addAutoFilter(ws, "G");

  report.barriers.forEach((b: Barrier, i: number) => {
    const row = ws.addRow([
      b.description,
      b.whyItMatters,
      b.severity,
      b.verificationStatus,
      b.responsibleParty,
      b.resolutionAction,
      b.blocksApproval ? "Yes" : "No",
    ]);
    applyDataRow(row, cols.length, i % 2 === 1);
    if (b.severity === "Critical") row.getCell(3).font = warnFont();
    if (b.verificationStatus === "Not Verified") row.getCell(4).font = warnFont();
    if (b.blocksApproval) row.getCell(7).font = warnFont();
  });
}

// ─── Sheet 7 — Sources ───────────────────────────────────────────────────────

function buildSourcesSheet(wb: ExcelJS.Workbook, input: ExportInput): void {
  const { report } = input;
  const ws = wb.addWorksheet("Sources");
  const cols = ["Agency", "Dataset / Report", "Direct URL", "Reporting Period", "Geography", "Retrieved Date", "Retrieval Method", "Confidence", "Reported or Derived"];

  ws.pageSetup = { orientation: "landscape", fitToPage: true, printTitlesRow: "1:1" };
  setColumnWidths(ws, [32, 32, 45, 18, 28, 16, 14, 12, 18]);
  freezeFirstRow(ws);

  const headerRow = ws.addRow(cols);
  applyHeaderRow(headerRow, cols.length);
  addAutoFilter(ws, "I");

  report.sources.forEach((src: ReportSource, i: number) => {
    const row = ws.addRow([
      src.sourceAgency,
      src.datasetName,
      src.directUrl ?? "Not available",
      src.reportingPeriod,
      src.geography,
      new Date(src.retrievedAt).toLocaleDateString("en-US"),
      src.retrievalMethod,
      src.confidence,
      src.isDerived ? "Derived" : "Reported",
    ]);
    applyDataRow(row, cols.length, i % 2 === 1);

    // Clickable URL
    if (src.directUrl) {
      const urlCell = row.getCell(3);
      urlCell.value = { text: src.directUrl, hyperlink: src.directUrl };
      urlCell.font = { color: { argb: BRAND_SECONDARY }, underline: true, size: 10 };
    }

    if (src.isDerived) row.getCell(9).font = { italic: true, size: 10 };
  });

  ws.addRow([]);
  const note = ws.addRow(["Note", "All metrics identify the geography and reporting period they describe. Do not mix figures from different geographies or years without reviewing their source entry. Derived metrics are estimates calculated from reported data."]);
  note.getCell(1).font = boldFont();
  note.getCell(2).font = { italic: true, size: 9, color: { argb: BRAND_MUTED } };
  note.getCell(2).alignment = wrapAlignment();
  note.height = 40;
}

// ─── Main builder ─────────────────────────────────────────────────────────────

export async function buildExcelWorkbook(input: ExportInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  wb.creator = "Find Home First";
  wb.lastModifiedBy = "Find Home First";
  wb.created = new Date(input.report.generatedAt);
  wb.modified = new Date(input.exportedAt);
  wb.properties.date1904 = false;

  buildSummarySheet(wb, input);
  buildScorecardSheet(wb, input);
  buildDemographicsSheet(wb, input);
  buildProgramsSheet(wb, input);
  buildEconomicsSheet(wb, input);
  buildBarriersSheet(wb, input);
  buildSourcesSheet(wb, input);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
