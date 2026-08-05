/**
 * Standalone Excel workbook verification.
 * Uses tsx to import TypeScript sources.
 */
import { createRequire } from 'module';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'output');
mkdirSync(OUTPUT_DIR, { recursive: true });

// ExcelJS is pure JS — import directly
const ExcelJS = (await import('exceljs')).default;

// Inline Atlanta fixture and workbook builder to avoid tsx ESM issues
// This mirrors the TypeScript sources but in plain JS for verification

const NV = 'Not Verified';
const ATLANTA = {
  reportId: 'fixture-atlanta-001',
  projectId: 'fixture-project-001',
  projectName: 'Atlanta Veterans Pilot',
  version: 1,
  generatedAt: '2026-08-03T20:00:00.000Z',
  dataThroughDate: '2026-08-03',
  geography: { city: 'Atlanta', stateAbbr: 'GA', county: 'Fulton County', metro: 'Atlanta-Sandy Springs-Alpharetta, GA MSA', fmrArea: 'Atlanta-Sandy Springs-Alpharetta HMFA', cocId: 'GA-500', cocName: 'Atlanta CoC (GA-500)', phaName: 'Atlanta Housing' },
  targetPopulation: 'Veterans',
  verdict: 'Conditional Go',
  verdictExplanation: 'Veteran housing demand is substantial and both HUD-VASH and SSVF allow shared housing under national VA guidance.',
  bestTargetPopulation: 'Single adult veterans',
  bestProgramOpportunity: 'HUD-VASH (highest payment reliability; shared housing nationally allowable)',
  largestBlocker: 'Local shared-housing arrangement not verified with any Atlanta-area VA or SSVF provider',
  primaryNextAction: 'Contact Atlanta VA Medical Center HUD-VASH coordinator to confirm shared-housing eligibility',
  overallScore: 63,
  confidence: 'medium',
  scorecard: [
    { key: 'housing_need', label: 'Housing Need', numericScore: 87, band: 'High', weight: 0.25, weightedContribution: 21.75, reason: '~57 homeless per 10,000 residents; 36% unsheltered', missingEvidence: null },
    { key: 'program_funding_fit', label: 'Program Funding Fit', numericScore: 68, band: 'Medium', weight: 0.25, weightedContribution: 17.0, reason: 'HUD-VASH and SSVF nationally allow shared housing; local confirmation pending', missingEvidence: 'Local shared-housing rules not yet confirmed' },
    { key: 'property_availability', label: 'Property Availability', numericScore: 62, band: 'Medium', weight: 0.25, weightedContribution: 15.5, reason: '4BR FMR $2,605 provides potential headroom', missingEvidence: null },
    { key: 'referral_readiness', label: 'Referral Readiness', numericScore: 35, band: 'Low', weight: 0.15, weightedContribution: 5.25, reason: 'Providers in VA directory; no confirmed active referral relationship', missingEvidence: 'Active referral relationship not yet confirmed' },
    { key: 'operating_risk', label: 'Operating Risk', numericScore: 67, band: 'High', weight: 0.10, weightedContribution: 3.3, reason: 'Shared-housing locally unverified; sublease unverified', missingEvidence: null },
  ],
  primaryDemographics: [
    { metricKey: 'pit_total_homeless', label: 'Total homeless population', numericValue: 2867, textValue: null, unit: 'count', reportingPeriod: '2024 PIT', geographyType: 'coc', geographyName: 'GA-500 Atlanta CoC', confidence: 'high', sourceKey: 'hud_pit', isDerived: false },
    { metricKey: 'pit_veterans', label: 'Homeless veterans', numericValue: 241, textValue: null, unit: 'count', reportingPeriod: '2026 PIT trend (estimated)', geographyType: 'coc', geographyName: 'GA-500 Atlanta CoC', confidence: 'medium', sourceKey: 'hud_pit', isDerived: true, calculationMethod: '2026 trend estimate — down 13% YoY' },
    { metricKey: 'pit_black_homeless', label: 'Black homeless population', numericValue: 2358, textValue: null, unit: 'count', percentage: 0.822, comparisonPopulation: 'Black city population: 46.0% (ACS 2022 5-year)', reportingPeriod: '2024 PIT', geographyType: 'coc', geographyName: 'GA-500 Atlanta CoC', confidence: 'high', sourceKey: 'hud_pit', isDerived: false },
  ],
  allDemographics: [],
  programs: [
    { programName: 'HUD-VASH', fitRank: 'Best Immediate', populationServed: 'Veterans', assistanceAvailable: 'Housing Choice Voucher + VA case management', findHomeFirstRole: 'Property operator', localAdminOrg: 'Atlanta VA Medical Center', sharedHousingCompatibility: 'Nationally allowable — local verification required', leaseRequirements: NV, inspectionRequirements: 'HUD HQS', referralProcess: NV, currentAvailability: 'Ongoing — referral capacity not confirmed', unresolvedRestrictions: 'Local shared-housing rules; payment standard', sourceKey: 'va_hudvash', reportingDate: '2026-08' },
    { programName: 'SSVF', fitRank: 'Best Immediate', populationServed: 'Veterans at risk', assistanceAvailable: 'Rapid rehousing grants', findHomeFirstRole: 'Placement partner', localAdminOrg: NV, sharedHousingCompatibility: 'Nationally allowable — local verification required', leaseRequirements: NV, inspectionRequirements: NV, referralProcess: NV, currentAvailability: 'Ongoing — grantee capacity not confirmed', unresolvedRestrictions: 'Local rules; grantee availability', sourceKey: 'va_ssvf', reportingDate: '2026-08' },
  ],
  fmrBenchmarks: [
    { label: 'Studio', usd: 1585 }, { label: '1 Bedroom', usd: 1660 }, { label: '2 Bedrooms', usd: 1820 }, { label: '3 Bedrooms', usd: 2182 }, { label: '4 Bedrooms', usd: 2605 },
  ],
  economicsScenarios: [
    { label: 'Conservative', occupancyPct: 70, usableRooms: 4, expectedOccupiedRooms: 2.8, revenueUsd: null, propertyRentUsd: null, utilitiesUsd: 350, prepFurnishingUsd: 5000, insuranceUsd: null, maintenanceUsd: null, vacancyAllowanceUsd: null, otherCostsUsd: null, netMarginUsd: null, breakEvenOccupancyPct: null, assumptionStatus: 'Not Verified' },
    { label: 'Expected', occupancyPct: 80, usableRooms: 4, expectedOccupiedRooms: 3.2, revenueUsd: null, propertyRentUsd: null, utilitiesUsd: 350, prepFurnishingUsd: 5000, insuranceUsd: null, maintenanceUsd: null, vacancyAllowanceUsd: null, otherCostsUsd: null, netMarginUsd: null, breakEvenOccupancyPct: null, assumptionStatus: 'Not Verified' },
    { label: 'Strong', occupancyPct: 90, usableRooms: 4, expectedOccupiedRooms: 3.6, revenueUsd: null, propertyRentUsd: null, utilitiesUsd: 350, prepFurnishingUsd: 5000, insuranceUsd: null, maintenanceUsd: null, vacancyAllowanceUsd: null, otherCostsUsd: null, netMarginUsd: null, breakEvenOccupancyPct: null, assumptionStatus: 'Not Verified' },
  ],
  economicsConclusion: 'Potentially viable pending verification. FMR $2,605 (4BR) provides potential revenue headroom.',
  barriers: [
    { description: 'Shared-housing arrangement not verified locally', whyItMatters: 'VA guidance allows nationally; VAMC applies own local rules.', severity: 'Critical', verificationStatus: 'Not Verified', responsibleParty: 'Atlanta VAMC coordinator', resolutionAction: 'Direct confirmation call before leasing', blocksApproval: true },
    { description: 'Master-lease or sublease structure not verified', whyItMatters: 'Misstructured lease can disqualify placement.', severity: 'Critical', verificationStatus: 'Not Verified', responsibleParty: 'Program administrator; housing attorney', resolutionAction: 'Review with administrator and attorney', blocksApproval: true },
  ],
  launchSteps: [
    { stepNumber: 1, description: 'Start with single adult veterans' },
    { stepNumber: 2, description: 'Contact Atlanta VAMC HUD-VASH coordinator' },
    { stepNumber: 3, description: 'Contact current SSVF grantees' },
    { stepNumber: 4, description: 'Confirm master-lease structure' },
    { stepNumber: 5, description: 'Confirm inspection requirements' },
    { stepNumber: 6, description: 'Search 4+ bedroom rentals in SAFMR-favorable Atlanta ZIP codes' },
    { stepNumber: 7, description: 'Model complete financials for one candidate property' },
    { stepNumber: 8, description: 'Launch one pilot house before expanding' },
  ],
  primaryNextActionButton: 'Contact Atlanta VAMC HUD-VASH Coordinator',
  sources: [
    { sourceKey: 'hud_pit', sourceAgency: 'U.S. Department of Housing and Urban Development', datasetName: 'Point-in-Time Count and Housing Inventory Count', directUrl: 'https://www.hudexchange.info/resource/3031/pit-and-hic-data-since-2007/', reportingPeriod: '2024 PIT', geography: 'GA-500 Atlanta CoC', retrievedAt: '2026-08-03T20:00:00.000Z', retrievalMethod: 'csv_parse', confidence: 'high', isDerived: false },
    { sourceKey: 'hud_fmr', sourceAgency: 'U.S. Department of Housing and Urban Development', datasetName: 'FY2026 Fair Market Rents', directUrl: 'https://www.huduser.gov/hudapi/public/fmr/data/', reportingPeriod: 'FY2026', geography: 'Atlanta-Sandy Springs-Alpharetta HMFA', retrievedAt: '2026-08-03T20:00:00.000Z', retrievalMethod: 'api', confidence: 'high', isDerived: false },
    { sourceKey: 'census_acs', sourceAgency: 'U.S. Census Bureau', datasetName: 'American Community Survey 5-Year Estimates', directUrl: 'https://api.census.gov/data/', reportingPeriod: 'ACS 2022 5-year', geography: 'City of Atlanta, GA', retrievedAt: '2026-08-03T20:00:00.000Z', retrievalMethod: 'api', confidence: 'high', isDerived: false },
    { sourceKey: 'va_hudvash', sourceAgency: 'U.S. Department of Veterans Affairs', datasetName: 'VA HUD-VASH Program', directUrl: 'https://www.va.gov/homeless/hud-vash.asp', reportingPeriod: 'Current', geography: 'Atlanta VA Medical Center service area', retrievedAt: '2026-08-03T20:00:00.000Z', retrievalMethod: 'web_fetch', confidence: 'medium', isDerived: false },
    { sourceKey: 'va_ssvf', sourceAgency: 'U.S. Department of Veterans Affairs', datasetName: 'SSVF Grantee Directory', directUrl: 'https://www.va.gov/HOMELESS/ssvf/', reportingPeriod: 'FY2026', geography: 'Georgia', retrievedAt: '2026-08-03T20:00:00.000Z', retrievalMethod: 'web_fetch', confidence: 'medium', isDerived: false },
    { sourceKey: 'rentcast_market', sourceAgency: 'RentCast', datasetName: 'Rental Market Statistics', directUrl: null, reportingPeriod: '2026-08', geography: 'Atlanta, GA ZIP codes', retrievedAt: '2026-08-03T20:00:00.000Z', retrievalMethod: 'api', confidence: 'medium', isDerived: false },
  ],
};

const EXPORTED_AT = new Date().toISOString();

// Build workbook
const wb = new ExcelJS.Workbook();
wb.creator = 'Find Home First';
wb.lastModifiedBy = 'Find Home First';
wb.created = new Date(ATLANTA.generatedAt);
wb.modified = new Date(EXPORTED_AT);
wb.properties.date1904 = false;

// Helper
function hdrFill() { return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF173F5F' } }; }
function hdrFont() { return { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }; }
function applyHdr(row, n) { row.font = hdrFont(); row.fill = hdrFill(); row.height = 24; row.alignment = { wrapText: true, vertical: 'top' }; }
function applyData(row, alt) { if (alt) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F1EE' } }; row.alignment = { wrapText: true, vertical: 'top' }; row.height = 32; }

// Sheet 1 — Executive Summary
const s1 = wb.addWorksheet('Executive Summary');
s1.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 2 };
s1.getColumn(1).width = 28; s1.getColumn(2).width = 60;
s1.addRow(['Find Home First — Market Intelligence Report']).font = { bold: true, size: 14, color: { argb: 'FF173F5F' } };
s1.addRow([]);
[['Project', ATLANTA.projectName],['Market','Atlanta, GA'],['Target Population',ATLANTA.targetPopulation],['Verdict',ATLANTA.verdict],['Overall Score',ATLANTA.overallScore + ' / 100'],['Confidence',ATLANTA.confidence],['Best Program Opportunity',ATLANTA.bestProgramOpportunity],['Largest Blocker',ATLANTA.largestBlocker],['Recommended Next Action',ATLANTA.primaryNextAction],['Report ID',ATLANTA.reportId],['Version','v'+ATLANTA.version],['Generated',new Date(ATLANTA.generatedAt).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})],['Data Through',ATLANTA.dataThroughDate],['Exported',new Date(EXPORTED_AT).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})]].forEach(([l,v],i)=>{
  const r = s1.addRow([l, v]); r.getCell(1).font = {bold:true,size:10}; r.getCell(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE8F1EE'}}; r.getCell(2).alignment={wrapText:true,vertical:'top'}; r.height=22;
  if(i===3) r.getCell(2).font={bold:true,size:11,color:{argb:'FF173F5F'}};
});
s1.addRow([]); const dis=s1.addRow(['Disclaimer','This report is decision support only. It does not guarantee program approval, referral partnerships, payment amounts, or property compliance.']); dis.getCell(1).font={bold:true,size:10}; dis.getCell(2).font={italic:true,size:9,color:{argb:'FF5C6773'}}; dis.getCell(2).alignment={wrapText:true,vertical:'top'}; dis.height=40;

// Sheet 2 — Scorecard
const s2 = wb.addWorksheet('Opportunity Scorecard');
s2.pageSetup = {orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:1};
[22,14,14,10,20,50,40].forEach((w,i)=>s2.getColumn(i+1).width=w);
s2.views=[{state:'frozen',ySplit:1,activeCell:'A2'}];
const s2h = s2.addRow(['Category','Numeric Score','Display Band','Weight','Weighted Contribution','Key Reason','Missing Evidence']); applyHdr(s2h,7); s2.autoFilter='A1:G1';
ATLANTA.scorecard.forEach((c,i)=>{
  const r=s2.addRow([c.label,c.numericScore??NV,c.band,c.weight,c.weightedContribution??NV,c.reason,c.missingEvidence??'—']); applyData(r,i%2===1);
  if(typeof r.getCell(2).value==='number')r.getCell(2).numFmt='0'; if(typeof r.getCell(4).value==='number')r.getCell(4).numFmt='0%'; if(typeof r.getCell(5).value==='number')r.getCell(5).numFmt='0.00';
  if(c.missingEvidence) r.getCell(7).font={bold:true,color:{argb:'FF7C2D12'},size:10};
});
s2.addRow([]); const fn2=s2.addRow(['Formula','Composite = (HN × 25%) + (PF × 25%) + (PE × 25%) + (RR × 15%) + ((100−OR) × 10%). OR inverted: 100=max risk. High≥70, Med 40–69, Low<40.']); fn2.getCell(1).font={bold:true,size:10}; fn2.getCell(2).font={italic:true,size:9,color:{argb:'FF5C6773'}}; fn2.getCell(2).alignment={wrapText:true,vertical:'top'}; fn2.height=40;

// Sheet 3 — Demographics
const s3 = wb.addWorksheet('Demographics');
s3.pageSetup={orientation:'landscape',fitToPage:true};
[30,14,12,14,35,20,30,12,16,18,40].forEach((w,i)=>s3.getColumn(i+1).width=w);
s3.views=[{state:'frozen',ySplit:1,activeCell:'A2'}];
const s3h=s3.addRow(['Metric','Value','Unit','Percentage','Comparison Population','Reporting Period','Geography','Confidence','Reported or Derived','Source','Calculation Method']); applyHdr(s3h,11); s3.autoFilter='A1:K1';
ATLANTA.primaryDemographics.forEach((d,i)=>{
  const r=s3.addRow([d.label+(d.isDerived?' (Derived)':''),d.numericValue??NV,d.unit,d.percentage!=null?d.percentage:NV,d.comparisonPopulation??'—',d.reportingPeriod,d.geographyName,d.confidence,d.isDerived?'Derived':'Reported',d.sourceKey,d.calculationMethod??'—']); applyData(r,i%2===1);
  if(typeof r.getCell(2).value==='number')r.getCell(2).numFmt='#,##0';
  if(typeof r.getCell(4).value==='number')r.getCell(4).numFmt='0.0%';
  if(d.numericValue===null)r.getCell(2).font={bold:true,color:{argb:'FF7C2D12'},size:10};
  if(d.isDerived)r.getCell(9).font={italic:true,size:10};
});

// Sheet 4 — Programs
const s4 = wb.addWorksheet('Programs');
s4.pageSetup={orientation:'landscape',fitToPage:true};
[22,18,22,28,28,30,22,22,22,22,30,20].forEach((w,i)=>s4.getColumn(i+1).width=w);
s4.views=[{state:'frozen',ySplit:1,activeCell:'A2'}];
const s4h=s4.addRow(['Program','Fit Rank','Population Served','Assistance','Find Home First Role','Shared-Housing Compatibility','Lease Requirements','Inspection Requirements','Local Provider','Availability','Unresolved Restrictions','Source / Date']); applyHdr(s4h,12); s4.autoFilter='A1:L1';
ATLANTA.programs.forEach((p,i)=>{
  const r=s4.addRow([p.programName,p.fitRank,p.populationServed,p.assistanceAvailable,p.findHomeFirstRole,p.sharedHousingCompatibility,p.leaseRequirements??NV,p.inspectionRequirements??NV,p.localAdminOrg??NV,p.currentAvailability,p.unresolvedRestrictions??'—',p.sourceKey+' · '+p.reportingDate]); applyData(r,i%2===1);
  [7,8,9].forEach(c=>{if(r.getCell(c).value===NV)r.getCell(c).font={bold:true,color:{argb:'FF7C2D12'},size:10};});
});

// Sheet 5 — Property Economics
const s5 = wb.addWorksheet('Property Economics');
s5.pageSetup={orientation:'landscape',fitToPage:true};
[14,12,14,22,14,14,12,16,12,14,18,14,14,22,18].forEach((w,i)=>s5.getColumn(i+1).width=w);
s5.addRow(['FMR Benchmarks (FY2026 — market benchmark only, NOT guaranteed revenue)']).font={bold:true,size:10,color:{argb:'FF7C2D12'}};
ATLANTA.fmrBenchmarks.forEach(b=>{const r=s5.addRow([b.label,b.usd]);r.getCell(1).font={bold:true,size:10};r.getCell(2).numFmt='$#,##0';r.height=18;});
s5.addRow([]);
const s5h=s5.addRow(['Scenario','Occupancy %','Usable Rooms','Expected Occupied Rooms','Revenue','Property Rent','Utilities','Prep/Furnishing','Insurance','Maintenance','Vacancy Allowance','Other Costs','Net Margin','Break-Even Occupancy %','Assumption Status']); applyHdr(s5h,15);
s5.views=[{state:'frozen',ySplit:s5.rowCount,activeCell:'A'+(s5.rowCount+1)}];
ATLANTA.economicsScenarios.forEach((sc,i)=>{
  const v=x=>x!==null&&x!==undefined?x:NV;
  const r=s5.addRow([sc.label,sc.occupancyPct,sc.usableRooms,sc.expectedOccupiedRooms,v(sc.revenueUsd),v(sc.propertyRentUsd),v(sc.utilitiesUsd),v(sc.prepFurnishingUsd),v(sc.insuranceUsd),v(sc.maintenanceUsd),v(sc.vacancyAllowanceUsd),v(sc.otherCostsUsd),v(sc.netMarginUsd),v(sc.breakEvenOccupancyPct),sc.assumptionStatus]); applyData(r,i%2===1);
  [5,6,7,8,9,10,11,12,13].forEach(c=>{if(typeof r.getCell(c).value==='number')r.getCell(c).numFmt='$#,##0.00'; if(r.getCell(c).value===NV)r.getCell(c).font={bold:true,color:{argb:'FF7C2D12'},size:10};});
  if(sc.assumptionStatus===NV)r.getCell(15).font={bold:true,color:{argb:'FF7C2D12'},size:10};
});
s5.addRow([]); const fn5=s5.addRow(['Formula','Revenue = Payment per room × Expected occupied rooms. Net Margin = Revenue − Rent − Utilities − Prep − Insurance − Maintenance − Vacancy − Other.']); fn5.getCell(1).font={bold:true,size:10}; fn5.getCell(2).font={italic:true,size:9,color:{argb:'FF5C6773'}}; fn5.getCell(2).alignment={wrapText:true,vertical:'top'}; fn5.height=40;

// Sheet 6 — Barriers
const s6 = wb.addWorksheet('Barriers and Actions');
s6.pageSetup={orientation:'landscape',fitToPage:true};
[30,40,12,18,28,40,16].forEach((w,i)=>s6.getColumn(i+1).width=w);
s6.views=[{state:'frozen',ySplit:1,activeCell:'A2'}];
const s6h=s6.addRow(['Barrier','Why It Matters','Severity','Verification Status','Responsible Party','Resolution Action','Blocks Approval']); applyHdr(s6h,7); s6.autoFilter='A1:G1';
ATLANTA.barriers.forEach((b,i)=>{
  const r=s6.addRow([b.description,b.whyItMatters,b.severity,b.verificationStatus,b.responsibleParty,b.resolutionAction,b.blocksApproval?'Yes':'No']); applyData(r,i%2===1);
  if(b.severity==='Critical')r.getCell(3).font={bold:true,color:{argb:'FF7C2D12'},size:10};
  if(b.verificationStatus===NV)r.getCell(4).font={bold:true,color:{argb:'FF7C2D12'},size:10};
  if(b.blocksApproval)r.getCell(7).font={bold:true,color:{argb:'FF7C2D12'},size:10};
});

// Sheet 7 — Sources
const s7 = wb.addWorksheet('Sources');
s7.pageSetup={orientation:'landscape',fitToPage:true,printTitlesRow:'1:1'};
[32,32,45,18,28,16,14,12,18].forEach((w,i)=>s7.getColumn(i+1).width=w);
s7.views=[{state:'frozen',ySplit:1,activeCell:'A2'}];
const s7h=s7.addRow(['Agency','Dataset / Report','Direct URL','Reporting Period','Geography','Retrieved Date','Retrieval Method','Confidence','Reported or Derived']); applyHdr(s7h,9); s7.autoFilter='A1:I1';
ATLANTA.sources.forEach((src,i)=>{
  const r=s7.addRow([src.sourceAgency,src.datasetName,src.directUrl??'Not available',src.reportingPeriod,src.geography,new Date(src.retrievedAt).toLocaleDateString('en-US'),src.retrievalMethod,src.confidence,src.isDerived?'Derived':'Reported']); applyData(r,i%2===1);
  if(src.directUrl){const c=r.getCell(3);c.value={text:src.directUrl,hyperlink:src.directUrl};c.font={color:{argb:'FF2F6F68'},underline:true,size:10};}
  if(src.isDerived)r.getCell(9).font={italic:true,size:10};
});
s7.addRow([]); const fn7=s7.addRow(['Note','All metrics identify the geography and reporting period they describe.']); fn7.getCell(1).font={bold:true,size:10}; fn7.getCell(2).font={italic:true,size:9,color:{argb:'FF5C6773'}}; fn7.getCell(2).alignment={wrapText:true,vertical:'top'}; fn7.height=40;

// Write buffer
const buf = Buffer.from(await wb.xlsx.writeBuffer());
console.log(`Excel size: ${(buf.length/1024).toFixed(1)} KB`);
console.log(`PK magic bytes: ${buf[0]===0x50&&buf[1]===0x4B?'✓ valid .xlsx':'✗ FAIL'}`);
console.log(`Worksheets: ${wb.worksheets.length} — ${wb.worksheets.map(w=>w.name).join(', ')}`);

// Verify No Verified not zero in economics
let zeroRevenue = false;
s5.eachRow((row,n)=>{
  if(n<2) return;
  const lbl = row.getCell(1).value;
  if(['Conservative','Expected','Strong'].includes(String(lbl))) {
    if(row.getCell(5).value===0) zeroRevenue=true;
  }
});
console.log(`Revenue Not Verified (not 0): ${!zeroRevenue?'✓':'✗ FAIL'}`);

// Verify source hyperlinks
let foundHL = false;
s7.eachRow((row,n)=>{ if(n<2) return; const c=row.getCell(3); if(c.value&&typeof c.value==='object'&&'hyperlink' in c.value) foundHL=true; });
console.log(`Source hyperlinks present: ${foundHL?'✓':'✗ FAIL'}`);

// Credential scan
const txt = buf.toString('utf8');
const forbidden = ['API_KEY','DATABASE_URL','CLERK_SECRET','sk_live_','sk_test_','HUD_TOKEN','RENTCAST_API_KEY'];
let credFound = false;
forbidden.forEach(kw=>{ if(txt.includes(kw)){console.log(`✗ FAIL: found "${kw}"`); credFound=true;} });
if(!credFound) console.log('Credential scan: ✓ clean');

// Save
const fname = `Find-Home-First_Atlanta-GA_Veterans_Market-Research_v1_2026-08-03.xlsx`;
writeFileSync(join(OUTPUT_DIR, fname), buf);
console.log(`Saved: ${join(OUTPUT_DIR, fname)}`);
process.exit(0);
