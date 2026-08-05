import { ATLANTA_FIXTURE } from "../src/lib/__tests__/fixtures/atlas-market-report.ts";
import { buildExcelWorkbook } from "../src/lib/export/excel-workbook.ts";
import { buildExportFilename } from "../src/lib/export/filename.ts";
import ExcelJS from "exceljs";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXPORTED_AT = new Date().toISOString();
const INPUT = { report: ATLANTA_FIXTURE, exportedAt: EXPORTED_AT };
let pass = 0, fail = 0;
function check(label, cond, detail = "") {
  if (cond) { console.log("  PASS: " + label); pass++; }
  else { console.error("  FAIL: " + label + (detail ? " -- " + detail : "")); fail++; }
}

console.log("\n=== Excel Structural Verification ===");
const buf = await buildExcelWorkbook(INPUT);
console.log("  Buffer: " + (buf.length/1024).toFixed(1) + " KB");
check("xlsx starts with PK magic bytes", buf[0]===0x50 && buf[1]===0x4B);

const wb = new ExcelJS.Workbook();
await wb.xlsx.load(buf);
const names = wb.worksheets.map(ws => ws.name);
console.log("  Sheets: " + names.join(", "));
check("7 worksheets", names.length === 7);
["Executive Summary","Opportunity Scorecard","Demographics","Programs","Property Economics","Barriers and Actions","Sources"].forEach(n => check(`Sheet "${n}" present`, names.includes(n)));

let hasFrozen = false;
wb.worksheets.forEach(ws => { const v = ws.views; if(v && v.some(x=>x.state==="frozen"&&(x.xSplit||x.ySplit))) hasFrozen=true; });
check("Frozen panes on at least one sheet", hasFrozen);

let hasAF = false;
wb.worksheets.forEach(ws => { if(ws.autoFilter) hasAF=true; });
check("Autofilters on at least one sheet", hasAF);

const content = buf.toString("latin1");
["sk_live_","sk_test_","DATABASE_URL","CLERK_SECRET","org_","API_KEY"].forEach(kw => check(`No "${kw}" in content`, !content.includes(kw)));

const econ = wb.getWorksheet("Property Economics");
let zeroRev = false;
econ.eachRow((row,n) => { if(n<2) return; if(["Conservative","Expected","Strong"].includes(String(row.getCell(1).value)) && row.getCell(5).value===0) zeroRev=true; });
check("Revenue Not Verified not stored as zero", !zeroRev);

const src = wb.getWorksheet("Sources");
let hasHyperlink = false;
src.eachRow((row,n) => { if(n<2) return; const c=row.getCell(3); if(c.value&&typeof c.value==="object"&&"hyperlink" in c.value) hasHyperlink=true; });
check("Source URLs are real hyperlinks", hasHyperlink);

const execSumm = wb.getWorksheet("Executive Summary");
check("pageSetup defined on Executive Summary", !!execSumm.pageSetup);

mkdirSync(join(__dirname,"scripts","output"),{recursive:true});
writeFileSync(join(__dirname,"scripts","output","Atlanta-GA_Veterans_v1.xlsx"), buf);
console.log("  Saved to scripts/output/Atlanta-GA_Veterans_v1.xlsx");

console.log("\n=== Results: " + pass + " passed, " + fail + " failed ===");
if(fail>0) process.exit(1);
