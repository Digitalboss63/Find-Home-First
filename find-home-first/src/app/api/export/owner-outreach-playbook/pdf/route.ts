/**
 * GET /api/export/owner-outreach-playbook/pdf
 *
 * Authorization:
 *   - requireOrganization() — org ID from Clerk session only
 *   - Returns 401 if not authenticated
 *
 * Returns:
 *   200 application/pdf — attachment
 *   401 — not authenticated
 *   500 — internal error (sanitized message only)
 *
 * Content is sourced entirely from src/lib/owner-outreach-playbook.ts.
 * No client-supplied parameters affect the output content.
 * Credentials and stack traces are never included in the response.
 */

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/auth";
import {
  PLAYBOOK_VERSION,
  openingScript,
  outreachFramework,
  objections,
  prohibitedAssurances,
  exportDisclaimer,
} from "@/lib/owner-outreach-playbook";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

// ─── PDF Layout Constants ─────────────────────────────────────────────────────

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
  guardrailBg: rgb(255 / 255, 241 / 255, 242 / 255),
  guardrailText: rgb(159 / 255, 18 / 255, 57 / 255),
  objectiveBg: rgb(254 / 255, 243 / 255, 199 / 255),
  objectiveText: rgb(146 / 255, 64 / 255, 14 / 255),
  followupBg: rgb(240 / 255, 253 / 255, 244 / 255),
  followupText: rgb(22 / 255, 101 / 255, 52 / 255),
};

// ─── Text Helpers ─────────────────────────────────────────────────────────────

function safeText(value: unknown): string {
  const text =
    value === null || value === undefined || value === ""
      ? ""
      : String(value);
  return text
    .replace(/[—–]/g, "-")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/\u2026/g, "...")
    .replace(/[\u2713\u2714]/g, "PASS")
    .replace(/[\u26A0]/g, "WARNING")
    .replace(/[\u2022\u00B7]/g, "-")
    .replace(/[\u2192]/g, "->")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E\n]/g, "");
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): string[] {
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

// ─── PDF Builder ──────────────────────────────────────────────────────────────

async function buildPlaybookPdf(): Promise<Buffer> {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);

  document.setTitle(
    `Find Home First - Owner Outreach Playbook - v${PLAYBOOK_VERSION}`
  );
  document.setAuthor("Find Home First");
  document.setSubject("Owner Outreach Playbook - Operator Guidance");
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
      maxWidth?: number;
    } = {}
  ) => {
    const font = options.font ?? regular;
    const size = options.size ?? 9;
    const color = options.color ?? COLORS.text;
    const indent = options.indent ?? 0;
    const gapAfter = options.gapAfter ?? 4;
    const maxW = options.maxWidth ?? CONTENT_WIDTH - indent;
    const lineHeight = size * 1.35;
    const lines = wrapText(safeText(text), font, size, maxW);
    for (const line of lines) {
      ensure(lineHeight + 2);
      page.drawText(line, { x: MARGIN + indent, y, size, font, color });
      y -= lineHeight;
    }
    y -= gapAfter;
  };

  const sectionHeader = (title: string) => {
    newPage();
    textBlock(title, {
      font: bold,
      size: 14,
      color: COLORS.primary,
      gapAfter: 6,
    });
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 1.5,
      color: COLORS.primary,
    });
    y -= 12;
  };

  const subHeading = (title: string) => {
    ensure(24);
    textBlock(title, {
      font: bold,
      size: 10.5,
      color: COLORS.secondary,
      gapAfter: 5,
    });
  };

  // ── Cover page ──────────────────────────────────────────────────────────────
  newPage();
  page.drawRectangle({
    x: MARGIN,
    y: PAGE_HEIGHT - 200,
    width: CONTENT_WIDTH,
    height: 130,
    color: COLORS.primary,
  });
  y = PAGE_HEIGHT - 105;
  textBlock("Find Home First", {
    font: bold,
    size: 22,
    color: COLORS.white,
    indent: 20,
    gapAfter: 6,
  });
  textBlock("Owner Outreach Playbook", {
    font: bold,
    size: 14,
    color: COLORS.white,
    indent: 20,
    gapAfter: 6,
  });
  textBlock(`Version ${PLAYBOOK_VERSION}`, {
    size: 10,
    color: COLORS.white,
    indent: 20,
    gapAfter: 0,
  });
  y = PAGE_HEIGHT - 230;
  textBlock(exportDisclaimer, { size: 8.5, color: COLORS.muted, gapAfter: 16 });

  // ── Section 1: Opening Script ───────────────────────────────────────────────
  sectionHeader("Opening Script");
  textBlock(openingScript.text, {
    size: 10,
    gapAfter: 12,
  });

  for (const fu of openingScript.followUps) {
    ensure(60);
    page.drawRectangle({
      x: MARGIN,
      y: y - 2,
      width: CONTENT_WIDTH,
      height: 2,
      color: COLORS.followupBg,
    });
    textBlock(fu.prompt, {
      font: bold,
      size: 8.5,
      color: COLORS.followupText,
      gapAfter: 3,
    });
    textBlock(fu.response, {
      size: 9,
      indent: 10,
      gapAfter: 10,
    });
  }

  // Primary objective
  ensure(36);
  page.drawRectangle({
    x: MARGIN,
    y: y - 2,
    width: CONTENT_WIDTH,
    height: 2,
    color: COLORS.objectiveBg,
  });
  y -= 6;
  textBlock("Primary Objective:", {
    font: bold,
    size: 9,
    color: COLORS.objectiveText,
    gapAfter: 3,
  });
  textBlock(openingScript.primaryObjective, {
    size: 9,
    color: COLORS.objectiveText,
    indent: 10,
    gapAfter: 8,
  });

  // ── Section 2: Outreach Framework ──────────────────────────────────────────
  sectionHeader(outreachFramework.name);

  // Steps as numbered list
  const stepsLine = outreachFramework.steps
    .map((s, i) => `${i + 1}. ${s}`)
    .join("  ->  ");
  textBlock(stepsLine, {
    font: bold,
    size: 10,
    color: COLORS.secondary,
    gapAfter: 8,
  });
  textBlock(outreachFramework.guidance, { size: 9, gapAfter: 8 });

  // ── Section 3: Objections ──────────────────────────────────────────────────
  sectionHeader("Owner Objections & Responses");

  for (const obj of objections) {
    ensure(52);
    subHeading(`${obj.id}. ${obj.objection}`);
    textBlock(obj.response, { size: 9, indent: 10, gapAfter: 10 });
  }

  // ── Section 4: Guardrails ──────────────────────────────────────────────────
  sectionHeader("Guardrails — " + prohibitedAssurances.title);

  for (const item of prohibitedAssurances.items) {
    ensure(16);
    textBlock(`X  ${item}`, {
      font: bold,
      size: 9,
      color: COLORS.guardrailText,
      indent: 4,
      gapAfter: 4,
    });
  }
  y -= 6;
  textBlock(prohibitedAssurances.guidance, {
    size: 8.5,
    color: COLORS.warning,
    gapAfter: 8,
  });

  // ── Footer on all pages ────────────────────────────────────────────────────
  const pages = document.getPages();
  pages.forEach((pdfPage, index) => {
    if (index > 0) {
      pdfPage.drawText("Find Home First - Owner Outreach Playbook", {
        x: MARGIN,
        y: PAGE_HEIGHT - 28,
        size: 7,
        font: regular,
        color: COLORS.muted,
      });
      pdfPage.drawLine({
        start: { x: MARGIN, y: PAGE_HEIGHT - 34 },
        end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 34 },
        thickness: 0.5,
        color: COLORS.border,
      });
    }
    pdfPage.drawLine({
      start: { x: MARGIN, y: 43 },
      end: { x: PAGE_WIDTH - MARGIN, y: 43 },
      thickness: 0.5,
      color: COLORS.border,
    });
    pdfPage.drawText(safeText(exportDisclaimer), {
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

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  // ── Auth ────────────────────────────────────────────────────────────────────
  try {
    await requireOrganization();
  } catch {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  // ── Generate PDF ────────────────────────────────────────────────────────────
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await buildPlaybookPdf();
  } catch {
    return NextResponse.json(
      { error: "PDF generation failed. Please try again." },
      { status: 500 }
    );
  }

  const filename = `Find-Home-First_Owner-Outreach-Playbook_v${PLAYBOOK_VERSION}.pdf`;

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBuffer.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
