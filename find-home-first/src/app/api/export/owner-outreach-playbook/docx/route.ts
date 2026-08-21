/**
 * GET /api/export/owner-outreach-playbook/docx
 *
 * Authorization:
 *   - requireOrganization() — org ID from Clerk session only
 *   - Returns 401 if not authenticated
 *
 * Returns:
 *   200 application/vnd.openxmlformats-officedocument.wordprocessingml.document — attachment
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
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  ShadingType,
} from "docx";

// ─── DOCX Builder ─────────────────────────────────────────────────────────────

async function buildPlaybookDocx(): Promise<Buffer> {
  const paragraphs: Paragraph[] = [];

  const spacer = (before = 80, after = 80) =>
    new Paragraph({ spacing: { before, after } });

  // ── Title ─────────────────────────────────────────────────────────────────
  paragraphs.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 120 },
      children: [
        new TextRun({
          text: "Find Home First \u2014 Owner Outreach Playbook",
          bold: true,
          size: 40,
          color: "17305F",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
      children: [
        new TextRun({
          text: `Version ${PLAYBOOK_VERSION}`,
          size: 22,
          color: "5C6773",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 240 },
      children: [
        new TextRun({
          text: exportDisclaimer,
          italics: true,
          size: 16,
          color: "92400E",
        }),
      ],
    })
  );

  // ── Section 1: Opening Script ─────────────────────────────────────────────
  paragraphs.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 80 },
      children: [
        new TextRun({
          text: openingScript.title,
          bold: true,
          size: 28,
          color: "17305F",
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 80, after: 160 },
      shading: {
        type: ShadingType.SOLID,
        color: "E8F1EE",
        fill: "E8F1EE",
      },
      border: {
        left: {
          style: BorderStyle.SINGLE,
          size: 6,
          color: "2F6F68",
        },
      },
      indent: { left: 120 },
      children: [
        new TextRun({
          text: openingScript.text,
          size: 20,
        }),
      ],
    })
  );

  // Follow-ups
  for (const fu of openingScript.followUps) {
    paragraphs.push(
      new Paragraph({
        spacing: { before: 120, after: 40 },
        children: [
          new TextRun({
            text: fu.prompt,
            bold: true,
            size: 18,
            color: "166534",
          }),
        ],
      }),
      new Paragraph({
        spacing: { before: 40, after: 80 },
        indent: { left: 240 },
        children: [
          new TextRun({
            text: fu.response,
            size: 18,
          }),
        ],
      })
    );
  }

  // Primary Objective
  paragraphs.push(
    spacer(120, 40),
    new Paragraph({
      spacing: { before: 40, after: 40 },
      shading: {
        type: ShadingType.SOLID,
        color: "FEF3C7",
        fill: "FEF3C7",
      },
      children: [
        new TextRun({
          text: "Primary Objective:  ",
          bold: true,
          size: 19,
          color: "92400E",
        }),
        new TextRun({
          text: openingScript.primaryObjective,
          size: 19,
          color: "92400E",
        }),
      ],
    })
  );

  // ── Section 2: Outreach Framework ────────────────────────────────────────
  paragraphs.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 320, after: 80 },
      children: [
        new TextRun({
          text: outreachFramework.name,
          bold: true,
          size: 28,
          color: "17305F",
        }),
      ],
    })
  );

  // Steps
  for (const step of outreachFramework.steps) {
    paragraphs.push(
      new Paragraph({
        spacing: { before: 40, after: 40 },
        bullet: { level: 0 },
        children: [
          new TextRun({
            text: step,
            bold: true,
            size: 20,
            color: "2F6F68",
          }),
        ],
      })
    );
  }

  paragraphs.push(
    new Paragraph({
      spacing: { before: 120, after: 80 },
      children: [
        new TextRun({
          text: outreachFramework.guidance,
          size: 18,
          italics: true,
        }),
      ],
    })
  );

  // ── Section 3: Objections ─────────────────────────────────────────────────
  paragraphs.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 320, after: 80 },
      children: [
        new TextRun({
          text: "Owner Objections & Responses",
          bold: true,
          size: 28,
          color: "17305F",
        }),
      ],
    })
  );

  for (const obj of objections) {
    paragraphs.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 160, after: 40 },
        children: [
          new TextRun({
            text: `${obj.id}. `,
            bold: true,
            size: 20,
            color: "2F6F68",
          }),
          new TextRun({
            text: obj.objection,
            bold: true,
            size: 20,
            color: "2F6F68",
          }),
        ],
      }),
      new Paragraph({
        spacing: { before: 40, after: 80 },
        indent: { left: 240 },
        children: [
          new TextRun({
            text: obj.response,
            size: 18,
          }),
        ],
      })
    );
  }

  // ── Section 4: Guardrails ─────────────────────────────────────────────────
  paragraphs.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 320, after: 80 },
      children: [
        new TextRun({
          text: "Guardrails",
          bold: true,
          size: 28,
          color: "17305F",
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 40, after: 80 },
      children: [
        new TextRun({
          text: prohibitedAssurances.title,
          bold: true,
          size: 19,
          color: "9F1239",
        }),
      ],
    })
  );

  for (const item of prohibitedAssurances.items) {
    paragraphs.push(
      new Paragraph({
        spacing: { before: 40, after: 40 },
        bullet: { level: 0 },
        children: [
          new TextRun({
            text: `X  ${item}`,
            bold: true,
            size: 18,
            color: "BE123C",
          }),
        ],
      })
    );
  }

  paragraphs.push(
    new Paragraph({
      spacing: { before: 120, after: 80 },
      shading: {
        type: ShadingType.SOLID,
        color: "FFF1F2",
        fill: "FFF1F2",
      },
      children: [
        new TextRun({
          text: prohibitedAssurances.guidance,
          size: 17,
          italics: true,
          color: "7F1D1D",
        }),
      ],
    })
  );

  // ── Disclaimer footer paragraph ──────────────────────────────────────────
  paragraphs.push(
    spacer(240, 80),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 80 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 4, color: "CBCBCB" },
      },
      children: [
        new TextRun({
          text: exportDisclaimer,
          italics: true,
          size: 15,
          color: "5C6773",
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [
      {
        children: paragraphs,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
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

  // ── Generate DOCX ───────────────────────────────────────────────────────────
  let docxBuffer: Buffer;
  try {
    docxBuffer = await buildPlaybookDocx();
  } catch {
    return NextResponse.json(
      { error: "DOCX generation failed. Please try again." },
      { status: 500 }
    );
  }

  const filename = `Find-Home-First_Owner-Outreach-Playbook_v${PLAYBOOK_VERSION}.docx`;

  return new NextResponse(docxBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(docxBuffer.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
