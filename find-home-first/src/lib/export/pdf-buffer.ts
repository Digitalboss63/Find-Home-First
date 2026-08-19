import {
  PDFDocument,
  PDFName,
  PDFString,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import type { ExportInput } from "./types";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_Y = 28;

const COLORS = {
  primary: rgb(23 / 255, 63 / 255, 95 / 255),
  secondary: rgb(47 / 255, 111 / 255, 104 / 255),
  action: rgb(180 / 255, 83 / 255, 9 / 255),
  text: rgb(31 / 255, 41 / 255, 51 / 255),
  muted: rgb(92 / 255, 103 / 255, 115 / 255),
  border: rgb(203 / 255, 213 / 255, 216 / 255),
  soft: rgb(232 / 255, 241 / 255, 238 / 255),
  warning: rgb(124 / 255, 45 / 255, 18 / 255),
  white: rgb(1, 1, 1),
};

function safeText(value: unknown): string {
  const text = value === null || value === undefined || value === "" ? "Not Verified" : String(value);
  return text
    .replace(/[—–]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/[✓✔]/g, "PASS")
    .replace(/[⚠]/g, "WARNING")
    .replace(/[•·]/g, "-")
    .replace(/[→]/g, "->")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E\n]/g, "");
}

function money(value: number | null | undefined): string {
  return value === null || value === undefined
    ? "Not Verified"
    : `$${Math.round(value).toLocaleString("en-US")}`;
}

function pct(value: number | null | undefined): string {
  return value === null || value === undefined ? "Not Verified" : `${(value * 100).toFixed(1)}%`;
}

function date(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const output: string[] = [];
  for (const paragraph of safeText(text).split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      output.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else if (line) {
        output.push(line);
        line = word;
      } else {
        let chunk = "";
        for (const char of word) {
          if (font.widthOfTextAtSize(chunk + char, size) > maxWidth && chunk) {
            output.push(chunk);
            chunk = char;
          } else {
            chunk += char;
          }
        }
        line = chunk;
      }
    }
    if (line) output.push(line);
  }
  return output;
}

/**
 * Generates the report without a React renderer or worker process. pdf-lib is
 * deterministic in a server route, which prevents an export request from
 * remaining open indefinitely when a renderer worker fails to settle.
 */
export async function buildPdfBuffer(input: ExportInput): Promise<Buffer> {
  const { report } = input;
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);

  document.setTitle(`Find Home First - City Demographic & Opportunity Report - ${report.geography.city}, ${report.geography.stateAbbr} - ${report.targetPopulation} - v${report.version}`);
  document.setAuthor("Find Home First");
  document.setSubject("City demographic, housing opportunity, program, and property economics decision-support report");
  document.setKeywords(["Find Home First", "housing", "city report", report.geography.city, report.targetPopulation]);
  document.setCreator("Find Home First");
  document.setProducer("Find Home First");

  let page!: PDFPage;
  let y = 0;

  const newPage = () => {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - 62;
  };

  const ensure = (height: number) => {
    if (y - height < 58) newPage();
  };

  const textBlock = (
    text: unknown,
    options: {
      font?: PDFFont;
      size?: number;
      color?: ReturnType<typeof rgb>;
      indent?: number;
      gapAfter?: number;
      link?: string | null;
    } = {},
  ) => {
    const font = options.font ?? regular;
    const size = options.size ?? 9;
    const color = options.color ?? COLORS.text;
    const indent = options.indent ?? 0;
    const lineHeight = size * 1.35;
    const lines = wrapText(safeText(text), font, size, CONTENT_WIDTH - indent);
    for (const line of lines) {
      ensure(lineHeight + 2);
      page.drawText(line, { x: MARGIN + indent, y, size, font, color });
      if (options.link) {
        const width = Math.min(font.widthOfTextAtSize(line, size), CONTENT_WIDTH - indent);
        const annotation = document.context.obj({
          Type: PDFName.of("Annot"),
          Subtype: PDFName.of("Link"),
          Rect: [MARGIN + indent, y - 2, MARGIN + indent + width, y + lineHeight],
          Border: [0, 0, 0],
          A: {
            Type: PDFName.of("Action"),
            S: PDFName.of("URI"),
            URI: PDFString.of(options.link),
          },
        });
        page.node.addAnnot(document.context.register(annotation));
      }
      y -= lineHeight;
    }
    y -= options.gapAfter ?? 4;
  };

  const section = (number: number, title: string, subtitle?: string) => {
    newPage();
    textBlock(`Section ${number} - ${title}`, { font: bold, size: 16, color: COLORS.primary, gapAfter: 5 });
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1.5, color: COLORS.primary });
    y -= 12;
    if (subtitle) textBlock(subtitle, { size: 9, color: COLORS.muted, gapAfter: 8 });
  };

  const labelValue = (label: string, value: unknown) => {
    ensure(28);
    page.drawText(safeText(label).toUpperCase(), { x: MARGIN, y, size: 7.5, font: bold, color: COLORS.muted });
    y -= 11;
    textBlock(value, { size: 9.5, indent: 10, gapAfter: 7 });
  };

  const item = (title: string, lines: Array<[string, unknown]>) => {
    ensure(42);
    textBlock(title, { font: bold, size: 10.5, color: COLORS.secondary, gapAfter: 4 });
    for (const [label, value] of lines) {
      textBlock(`${label}: ${safeText(value)}`, { size: 8.5, indent: 10, gapAfter: 2 });
    }
    y -= 6;
  };

  // Cover
  newPage();
  page.drawRectangle({ x: MARGIN, y: PAGE_HEIGHT - 300, width: CONTENT_WIDTH, height: 190, color: COLORS.primary });
  y = PAGE_HEIGHT - 145;
  textBlock("Find Home First", { font: bold, size: 23, color: COLORS.white, indent: 20, gapAfter: 7 });
  textBlock("City Demographic & Opportunity Report", { font: bold, size: 15, color: COLORS.white, indent: 20, gapAfter: 8 });
  textBlock(report.projectName, { size: 12, color: COLORS.white, indent: 20, gapAfter: 4 });
  textBlock(`${report.geography.city}, ${report.geography.stateAbbr} - ${report.targetPopulation}`, { size: 11, color: COLORS.white, indent: 20, gapAfter: 8 });
  textBlock(`VERDICT: ${report.verdict}`, { font: bold, size: 12, color: COLORS.white, indent: 20 });
  y = PAGE_HEIGHT - 335;
  labelValue("Report version", `v${report.version}`);
  labelValue("Generated", date(report.generatedAt));
  labelValue("Data through", report.dataThroughDate);
  labelValue("Geography", `${report.geography.city}, ${report.geography.stateAbbr}`);
  if (input.onlineReportUrl) textBlock(input.onlineReportUrl, { size: 8, color: COLORS.secondary, link: input.onlineReportUrl });

  // 1 - How to use
  section(1, "How to Use This Report");
  const guidance = [
    ["Read the verdict first", "Go supports proceeding. Conditional Go means resolve the listed conditions first. No-Go means current conditions do not support proceeding. Insufficient Evidence means required evidence could not be verified."],
    ["Use it as decision support", "This report does not guarantee program approval, referrals, payment amounts, owner acceptance, or property compliance."],
    ["Confirm local program rules", "Contact the named program administrator before relying on shared-housing eligibility, payment standards, referral processes, master leases, or subleases."],
    ["Treat FMR carefully", "HUD Fair Market Rent is a market benchmark, not a guaranteed payment per room."],
    ["Review dates and geography", "PIT counts are one-night CoC estimates. Other metrics may use city, county, metro, state, or national data from different reporting periods."],
    ["Resolve barriers before leasing", "Complete the recommended next action and resolve material barriers before signing a property agreement."],
  ];
  for (const [heading, body] of guidance) item(heading, [["Guidance", body]]);

  // 2 - Verdict
  section(2, "Market Verdict");
  textBlock(report.verdict, { font: bold, size: 20, color: report.verdict === "No-Go" ? COLORS.warning : COLORS.action, gapAfter: 10 });
  textBlock(report.verdictExplanation, { size: 10, gapAfter: 12 });
  labelValue("Overall score", report.overallScore === null ? "Not Verified" : `${report.overallScore}/100`);
  labelValue("Confidence", report.confidence);
  labelValue("Best population", report.bestTargetPopulation);
  labelValue("Best program", report.bestProgramOpportunity);
  labelValue("Largest blocker", report.largestBlocker);
  labelValue("Next action", report.primaryNextAction);

  // 3 - Scorecard
  section(3, "Market Scorecard", "Weighted scoring across five dimensions");
  for (const row of report.scorecard) {
    item(row.label, [
      ["Score", row.numericScore === null ? "Not Verified" : `${row.numericScore}/100 (${row.band})`],
      ["Weight", `${Math.round(row.weight * 100)}%`],
      ["Contribution", row.weightedContribution ?? "Not Verified"],
      ["Reason", row.reason],
      ["Missing evidence", row.missingEvidence ?? "None identified"],
    ]);
  }

  // 4 - Demographics
  section(4, "People Who Need Housing", "Demographics and housing-need evidence");
  const demographics = report.allDemographics.length ? report.allDemographics : report.primaryDemographics;
  for (const metric of demographics) {
    const value = metric.textValue ?? (metric.numericValue === null ? "Not Verified" : metric.numericValue.toLocaleString("en-US"));
    item(metric.label, [
      ["Value", `${value}${metric.unit ? ` ${metric.unit}` : ""}`],
      ["Percentage", metric.percentage === null || metric.percentage === undefined ? "Not Verified" : pct(metric.percentage)],
      ["Period / geography", `${metric.reportingPeriod}; ${metric.geographyName}`],
      ["Confidence", metric.confidence],
      ["Source", metric.sourceKey],
    ]);
  }

  // 5 - Programs
  section(5, "Program Opportunities");
  if (!report.programs.length) textBlock("No program opportunities were verified.");
  for (const program of report.programs) {
    item(program.programName, [
      ["Fit", program.fitRank],
      ["Population", program.populationServed],
      ["Assistance", program.assistanceAvailable],
      ["Find Home First role", program.findHomeFirstRole],
      ["Local administrator", program.localAdminOrg],
      ["Shared housing", program.sharedHousingCompatibility],
      ["Availability", program.currentAvailability],
      ["Restrictions", program.unresolvedRestrictions],
    ]);
  }

  // 6 - Economics
  section(6, "Property Economics");
  textBlock("HUD Fair Market Rent Benchmarks", { font: bold, size: 11, color: COLORS.secondary });
  for (const benchmark of report.fmrBenchmarks) textBlock(`${benchmark.label}: ${money(benchmark.usd)}`, { indent: 10, gapAfter: 2 });
  y -= 8;
  for (const scenario of report.economicsScenarios) {
    item(`${scenario.label} scenario`, [
      ["Occupancy", `${scenario.occupancyPct}% (${scenario.expectedOccupiedRooms} of ${scenario.usableRooms} rooms)`],
      ["Revenue", money(scenario.revenueUsd)],
      ["Property rent", money(scenario.propertyRentUsd)],
      ["Utilities", money(scenario.utilitiesUsd)],
      ["Other operating costs", money((scenario.prepFurnishingUsd ?? 0) + (scenario.insuranceUsd ?? 0) + (scenario.maintenanceUsd ?? 0) + (scenario.vacancyAllowanceUsd ?? 0) + (scenario.otherCostsUsd ?? 0))],
      ["Net margin", money(scenario.netMarginUsd)],
      ["Break-even occupancy", scenario.breakEvenOccupancyPct === null ? "Not Verified" : `${scenario.breakEvenOccupancyPct}%`],
      ["Assumptions", scenario.assumptionStatus],
    ]);
  }
  textBlock(report.economicsConclusion, { font: bold, size: 9.5, color: COLORS.primary });

  // 7 - Barriers
  section(7, "Barriers and Missing Information");
  if (!report.barriers.length) textBlock("No material barriers were identified in the collected evidence.");
  for (const barrier of report.barriers) {
    item(barrier.description, [
      ["Why it matters", barrier.whyItMatters],
      ["Severity / status", `${barrier.severity}; ${barrier.verificationStatus}`],
      ["Responsible party", barrier.responsibleParty],
      ["Resolution", barrier.resolutionAction],
      ["Blocks approval", barrier.blocksApproval ? "Yes" : "No"],
    ]);
  }

  // 8 - Strategy
  section(8, "Recommended Launch Strategy");
  for (const step of report.launchSteps) textBlock(`${step.stepNumber}. ${step.description}`, { font: step.stepNumber === 1 ? bold : regular, size: 10, gapAfter: 8 });
  labelValue("Primary next action", report.primaryNextActionButton);

  // 9 - Sources
  section(9, "Sources and Methodology");
  for (const source of report.sources) {
    item(`${source.sourceAgency} - ${source.datasetName}`, [
      ["Period / geography", `${source.reportingPeriod}; ${source.geography}`],
      ["Retrieved", date(source.retrievedAt)],
      ["Method / confidence", `${source.retrievalMethod}; ${source.confidence}`],
      ["Data type", source.isDerived ? "Derived estimate" : "Published value"],
    ]);
    if (source.directUrl) textBlock(source.directUrl, { size: 7.5, color: COLORS.secondary, indent: 10, link: source.directUrl, gapAfter: 7 });
  }

  const pages = document.getPages();
  pages.forEach((pdfPage, index) => {
    if (index > 0) {
      pdfPage.drawText(safeText(`${report.projectName} - City Demographic & Opportunity Report`), {
        x: MARGIN,
        y: PAGE_HEIGHT - 28,
        size: 7,
        font: regular,
        color: COLORS.muted,
      });
      pdfPage.drawLine({ start: { x: MARGIN, y: PAGE_HEIGHT - 34 }, end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 34 }, thickness: 0.5, color: COLORS.border });
    }
    pdfPage.drawLine({ start: { x: MARGIN, y: 43 }, end: { x: PAGE_WIDTH - MARGIN, y: 43 }, thickness: 0.5, color: COLORS.border });
    pdfPage.drawText("Decision support only. Verify program rules, payments, referrals, and property compliance directly.", {
      x: MARGIN,
      y: FOOTER_Y,
      size: 6.2,
      font: regular,
      color: COLORS.muted,
    });
    const pageLabel = `${index + 1} / ${pages.length}`;
    pdfPage.drawText(pageLabel, {
      x: PAGE_WIDTH - MARGIN - regular.widthOfTextAtSize(pageLabel, 7),
      y: FOOTER_Y,
      size: 7,
      font: regular,
      color: COLORS.muted,
    });
  });

  const bytes = await document.save({ useObjectStreams: false });
  return Buffer.from(bytes);
}
