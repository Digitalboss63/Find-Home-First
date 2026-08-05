/**
 * Standalone export verification script.
 *
 * Runs outside Vitest to avoid @react-pdf/renderer worker lifecycle issues.
 *
 * Usage: node --import tsx/esm scripts/verify-exports.mjs
 *   or:  npx tsx scripts/verify-exports.mjs
 *
 * Generates sample Atlanta PDF and Excel files and prints a verification report.
 * Does NOT require a database connection or Clerk auth.
 * Does NOT commit or push any files.
 *
 * Output files (for visual review only — not committed):
 *   scripts/output/Atlanta-GA_Veterans_sample.pdf
 *   scripts/output/Atlanta-GA_Veterans_sample.xlsx
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "output");
mkdirSync(OUTPUT_DIR, { recursive: true });

// ── Import modules ───────────────────────────────────────────────────────────

const { ATLANTA_FIXTURE } = await import("../src/lib/__tests__/fixtures/atlas-market-report.ts");
const { buildReportDocument } = await import("../src/lib/export/pdf-document.tsx");
const { buildExcelWorkbook } = await import("../src/lib/export/excel-workbook.ts");
const { buildExportFilename } = await import("../src/lib/export/filename.ts");
const { renderToBuffer } = await import("@react-pdf/renderer");
const React = (await import("react")).default;

const EXPORTED_AT = new Date().toISOString();
const INPUT = { report: ATLANTA_FIXTURE, exportedAt: EXPORTED_AT };

let pass = 0;
let fail = 0;

function check(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.error(`  ✗ FAIL: ${label}${detail ? " — " + detail : ""}`);
    fail++;
  }
}

// ── PDF verification ─────────────────────────────────────────────────────────

console.log("\n=== PDF Export Verification ===");

const pdfFilename = buildExportFilename({
  city: ATLANTA_FIXTURE.geography.city,
  stateAbbr: ATLANTA_FIXTURE.geography.stateAbbr,
  targetPopulation: ATLANTA_FIXTURE.targetPopulation,
  version: ATLANTA_FIXTURE.version,
  generatedAt: ATLANTA_FIXTURE.generatedAt,
  format: "pdf",
});
console.log(`  Filename: ${pdfFilename}`);
check(
  "PDF filename follows convention",
  pdfFilename === "Find-Home-First_Atlanta-GA_Veterans_Market-Research_v1_2026-08-03.pdf"
);
check("PDF filename contains only safe characters", /^[A-Za-z0-9._-]+$/.test(pdfFilename));

let pdfBuffer;
try {
  const doc = buildReportDocument(INPUT);
  pdfBuffer = await renderToBuffer(doc);
  console.log(`  Buffer size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`);

  check("PDF starts with %PDF magic bytes", pdfBuffer.slice(0, 4).toString() === "%PDF");
  check("PDF is at least 20 KB", pdfBuffer.length > 20 * 1024);

  // Credentials scan (binary → latin1 for string search)
  const pdfText = pdfBuffer.toString("latin1");
  const forbidden = ["API_KEY", "DATABASE_URL", "CLERK_SECRET", "sk_live_", "sk_test_", "HUD_TOKEN", "CENSUS_KEY"];
  forbidden.forEach((kw) => check(`PDF contains no "${kw}"`, !pdfText.includes(kw)));

  // Write sample file
  const pdfPath = join(OUTPUT_DIR, pdfFilename);
  writeFileSync(pdfPath, pdfBuffer);
  console.log(`  Sample saved: ${pdfPath}`);

} catch (err) {
  console.error(`  ✗ PDF render FAILED: ${err.message}`);
  fail++;
}

// ── Excel verification ───────────────────────────────────────────────────────

console.log("\n=== Excel Export Verification ===");

const xlsxFilename = buildExportFilename({
  city: ATLANTA_FIXTURE.geography.city,
  stateAbbr: ATLANTA_FIXTURE.geography.stateAbbr,
  targetPopulation: ATLANTA_FIXTURE.targetPopulation,
  version: ATLANTA_FIXTURE.version,
  generatedAt: ATLANTA_FIXTURE.generatedAt,
  format: "xlsx",
});
console.log(`  Filename: ${xlsxFilename}`);
check("xlsx filename follows convention", xlsxFilename.endsWith(".xlsx"));
check("xlsx filename contains only safe characters", /^[A-Za-z0-9._-]+$/.test(xlsxFilename));

let xlsxBuffer;
try {
  xlsxBuffer = await buildExcelWorkbook(INPUT);
  console.log(`  Buffer size: ${(xlsxBuffer.length / 1024).toFixed(1)} KB`);

  // xlsx starts with PK (zip magic)
  check("xlsx starts with PK (zip magic bytes)", xlsxBuffer[0] === 0x50 && xlsxBuffer[1] === 0x4B);
  check("xlsx is at least 5 KB", xlsxBuffer.length > 5 * 1024);

  // Credential scan
  const xlsxText = xlsxBuffer.toString("utf8");
  const forbidden = ["API_KEY", "DATABASE_URL", "CLERK_SECRET", "sk_live_", "sk_test_", "HUD_TOKEN", "RENTCAST_API_KEY"];
  forbidden.forEach((kw) => check(`xlsx contains no "${kw}"`, !xlsxText.includes(kw)));

  // Verify 7 worksheets by loading with ExcelJS
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(xlsxBuffer);
  const sheetNames = wb.worksheets.map((ws) => ws.name);
  console.log(`  Worksheets (${sheetNames.length}): ${sheetNames.join(", ")}`);
  check("7 worksheets present", sheetNames.length === 7);
  const required = ["Executive Summary", "Opportunity Scorecard", "Demographics", "Programs", "Property Economics", "Barriers and Actions", "Sources"];
  required.forEach((name) => check(`Sheet "${name}" present`, sheetNames.includes(name)));

  // Check frozen panes
  let hasFrozenPane = false;
  wb.worksheets.forEach((ws) => {
    const views = ws.views;
    if (views && views.some((v) => v.state === "frozen" && (v.xSplit || v.ySplit))) {
      hasFrozenPane = true;
    }
  });
  check("Frozen panes exist on at least one sheet", hasFrozenPane);

  // Check autofilters
  let hasAutoFilter = false;
  wb.worksheets.forEach((ws) => {
    if (ws.autoFilter) hasAutoFilter = true;
  });
  check("Autofilters exist on at least one sheet", hasAutoFilter);

  // Check Not Verified not zero in economics
  const econ = wb.getWorksheet("Property Economics");
  let zeroRevenue = false;
  econ.eachRow((row, n) => {
    if (n < 2) return;
    const label = row.getCell(1).value;
    if (["Conservative", "Expected", "Strong"].includes(String(label))) {
      if (row.getCell(5).value === 0) zeroRevenue = true;
    }
  });
  check("Revenue Not Verified — not stored as zero", !zeroRevenue);

  // Check source URLs are hyperlinks
  const sources = wb.getWorksheet("Sources");
  let foundHyperlink = false;
  sources.eachRow((row, n) => {
    if (n < 2) return;
    const cell = row.getCell(3);
    if (cell.value && typeof cell.value === "object" && "hyperlink" in cell.value) {
      foundHyperlink = true;
    }
  });
  check("Source URLs are real hyperlinks", foundHyperlink);

  // Write sample file
  const xlsxPath = join(OUTPUT_DIR, xlsxFilename);
  writeFileSync(xlsxPath, xlsxBuffer);
  console.log(`  Sample saved: ${xlsxPath}`);

} catch (err) {
  console.error(`  ✗ Excel generation FAILED: ${err.message}`);
  fail++;
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n=== Results: ${pass} passed, ${fail} failed ===\n`);
if (fail > 0) process.exit(1);
