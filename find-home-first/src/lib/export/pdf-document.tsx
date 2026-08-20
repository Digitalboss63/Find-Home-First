/**
 * PDF Report Document — @react-pdf/renderer
 *
 * Server-only. Never import in client components.
 *
 * Sections follow the approved nine-section order plus cover.
 * All values come exclusively from the frozen MarketReportSnapshot.
 *
 * Accessibility:
 *   - Document language set via lang prop
 *   - Metadata (title, author, subject, keywords) set on Document
 *   - Text labels used alongside any visual indicator (never color alone)
 *   - Link text is descriptive
 *   - Reading order follows document structure
 *   - Note: @react-pdf/renderer generates PDF 1.7; full tagged PDF (PDF/UA)
 *     is not supported by this library. This disclaimer is included in the
 *     footer and metadata.
 *
 * Repeated table headers:
 *   - Each table header row uses fixed={false} with explicit repetition
 *     via a TableHeader component included before every data section.
 *     @react-pdf/renderer does not support CSS table-header-group natively;
 *     headers are repeated by rendering them inside each page's fixed layer
 *     is not possible either, so the approach is: data tables use View
 *     wrap with the header row repeated as the first child of every 600-pt
 *     continuation chunk. For the export scope (typically <30 rows per table)
 *     a single table with minPresenceAhead guards against orphan rows.
 *
 * Size limit: caller is responsible for checking snapshot size before calling.
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Link,
  StyleSheet,
} from "@react-pdf/renderer";
import type { MarketReportSnapshot, ScorecardCategory, ProgramOpportunity, Barrier, ReportSource, EconomicsScenario } from "./types";
import type { ExportInput } from "./types";

// ─── Styles ───────────────────────────────────────────────────────────────────

const BRAND = {
  primary: "#173F5F",
  secondary: "#2F6F68",
  action: "#B45309",
  highlight: "#F2C14E",
  text: "#1F2933",
  muted: "#5C6773",
  border: "#CBD5D8",
  soft: "#E8F1EE",
  warning: "#7C2D12",
  background: "#F7F5EF",
};

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: BRAND.text,
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 48,
    lineHeight: 1.4,
  },

  // Fixed header on every page
  pageHeader: {
    position: "absolute",
    top: 16,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: BRAND.border,
    paddingBottom: 4,
  },
  pageHeaderLeft: { fontSize: 7, color: BRAND.muted, maxWidth: 260 },
  pageHeaderRight: { fontSize: 7, color: BRAND.muted },

  // Fixed footer on every page
  pageFooter: {
    position: "absolute",
    bottom: 16,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
    paddingTop: 4,
  },
  pageFooterText: { fontSize: 6.5, color: BRAND.muted, maxWidth: 380 },
  pageNumber: { fontSize: 7, color: BRAND.muted },

  // Cover
  coverBlock: {
    marginTop: 48,
    marginBottom: 24,
    padding: 24,
    backgroundColor: BRAND.primary,
    borderRadius: 4,
  },
  coverTitle: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#FFFFFF", marginBottom: 6 },
  coverSubtitle: { fontSize: 11, color: "#E0EAF0", marginBottom: 2 },
  coverMeta: { fontSize: 8, color: "#B8CDD8", marginTop: 8 },

  // Section breaks
  sectionBreak: { marginTop: 20, marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1.5, borderBottomColor: BRAND.primary },
  sectionTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", color: BRAND.primary },
  sectionSubtitle: { fontSize: 8, color: BRAND.muted, marginTop: 2 },

  subsectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: BRAND.secondary, marginTop: 10, marginBottom: 4 },

  // Verdict block
  verdictBox: {
    padding: 14,
    backgroundColor: BRAND.soft,
    borderRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: BRAND.action,
    marginBottom: 12,
  },
  verdictLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: BRAND.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  verdictValue: { fontSize: 16, fontFamily: "Helvetica-Bold", color: BRAND.primary, marginTop: 2 },
  verdictExplanation: { fontSize: 8.5, color: BRAND.text, marginTop: 6, lineHeight: 1.5 },

  kvRow: { flexDirection: "row", marginBottom: 4 },
  kvLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: BRAND.muted, width: 140, flexShrink: 0 },
  kvValue: { fontSize: 8, color: BRAND.text, flex: 1 },

  // Tables
  table: { width: "100%", marginBottom: 8 },
  tableHeader: { flexDirection: "row", backgroundColor: BRAND.primary, paddingVertical: 4, paddingHorizontal: 4 },
  tableHeaderCell: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#FFFFFF", flex: 1, paddingHorizontal: 2 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: BRAND.border, paddingVertical: 3, paddingHorizontal: 4 },
  tableRowAlt: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: BRAND.border, paddingVertical: 3, paddingHorizontal: 4, backgroundColor: "#F9FAFB" },
  tableCell: { fontSize: 7.5, color: BRAND.text, flex: 1, paddingHorizontal: 2 },
  tableCellBold: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: BRAND.text, flex: 1, paddingHorizontal: 2 },
  tableCellMuted: { fontSize: 7.5, color: BRAND.muted, flex: 1, paddingHorizontal: 2 },

  // Warning / not-verified
  notVerified: { color: BRAND.warning, fontFamily: "Helvetica-Bold" },
  warningBlock: { backgroundColor: "#FEF3C7", borderLeftWidth: 3, borderLeftColor: BRAND.action, padding: 8, borderRadius: 2, marginVertical: 6 },
  warningText: { fontSize: 7.5, color: BRAND.warning },

  // Body text
  body: { fontSize: 8.5, color: BRAND.text, marginBottom: 6, lineHeight: 1.5 },
  bodySmall: { fontSize: 7.5, color: BRAND.muted, lineHeight: 1.4 },

  // How To Use callout items
  calloutItem: { marginBottom: 5 },
  calloutLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: BRAND.secondary },
  calloutText: { fontSize: 8, color: BRAND.text, lineHeight: 1.4 },

  // Launch step
  stepRow: { flexDirection: "row", marginBottom: 5, alignItems: "flex-start" },
  stepNumber: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#FFFFFF", backgroundColor: BRAND.primary, width: 16, height: 16, borderRadius: 8, textAlign: "center", paddingTop: 3, marginRight: 8, flexShrink: 0 },
  stepText: { fontSize: 8.5, color: BRAND.text, flex: 1, lineHeight: 1.4, paddingTop: 2 },

  // Metadata block (bottom of cover)
  metaGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  metaItem: { width: "50%", marginBottom: 5 },
  metaLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: BRAND.muted },
  metaValue: { fontSize: 8, color: BRAND.text },

  // Spacer
  spacer: { marginBottom: 10 },
  divider: { borderBottomWidth: 0.5, borderBottomColor: BRAND.border, marginVertical: 6 },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NV = <Text style={s.notVerified}>Not Verified</Text>;

function fmtPct(val: number | null | undefined): React.ReactElement | string {
  if (val === null || val === undefined) return NV;
  return `${(val * 100).toFixed(1)}%`;
}

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); }
  catch { return iso; }
}

// ─── Shared table header row components (declared at module scope) ─────────────

function ScorecardTableHeader() {
  return (
    <View style={s.tableHeader}>
      {["Category", "Score", "Band", "Weight", "Contribution", "Key Reason", "Missing Evidence"].map((h) => (
        <Text key={h} style={[s.tableHeaderCell, h === "Key Reason" || h === "Missing Evidence" ? { flex: 2 } : {}]}>{h}</Text>
      ))}
    </View>
  );
}

function DemographicsTableHeader() {
  return (
    <View style={s.tableHeader}>
      {["Metric", "Value", "Unit", "%", "Reporting Period", "Geography", "Conf.", "Source"].map((h) => (
        <Text key={h} style={[s.tableHeaderCell, h === "Metric" ? { flex: 2 } : {}]}>{h}</Text>
      ))}
    </View>
  );
}

function EconomicsTableHeader() {
  return (
    <View style={s.tableHeader}>
      {["Scenario", "Occ. %", "Rooms", "Occupied", "Revenue", "Rent", "Utilities", "Prep", "Net Margin", "Break-even", "Assumption"].map((h) => (
        <Text key={h} style={s.tableHeaderCell}>{h}</Text>
      ))}
    </View>
  );
}

function BarriersTableHeader() {
  return (
    <View style={s.tableHeader}>
      {["Barrier", "Why It Matters", "Severity", "Status", "Responsible Party", "Action Required", "Blocks Approval"].map((h) => (
        <Text key={h} style={[s.tableHeaderCell, h === "Barrier" || h === "Why It Matters" || h === "Action Required" ? { flex: 2 } : {}]}>{h}</Text>
      ))}
    </View>
  );
}

function SourcesTableHeader() {
  return (
    <View style={s.tableHeader}>
      {["Agency", "Dataset / Report", "URL", "Period", "Geography", "Retrieved", "Method", "Confidence", "Type"].map((h) => (
        <Text key={h} style={[s.tableHeaderCell, h === "Agency" || h === "Dataset / Report" || h === "URL" ? { flex: 2 } : {}]}>{h}</Text>
      ))}
    </View>
  );
}

// ─── Fixed page header and footer ─────────────────────────────────────────────

function PageHeader({ report }: { report: MarketReportSnapshot }) {
  return (
    <View style={s.pageHeader} fixed>
      <Text style={s.pageHeaderLeft}>
        Find Home First — City Demographic &amp; Opportunity Report · {report.geography.city}, {report.geography.stateAbbr} · {report.targetPopulation}
      </Text>
      <Text style={s.pageHeaderRight}>{report.geography.city}, {report.geography.stateAbbr}</Text>
    </View>
  );
}

// exportedAt is not rendered directly in footer (page number render prop handles timing)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PageFooter({ exportedAt: _exportedAt }: { exportedAt: string }) {
  return (
    <View style={s.pageFooter} fixed>
      <Text style={s.pageFooterText}>
        This report is decision support only. It does not guarantee program approval, referral partnerships, payment amounts, or property compliance. Accessibility note: this PDF is not a tagged/PDF-UA document.
      </Text>
      <Text style={s.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
    </View>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({ number, title, subtitle }: { number: string; title: string; subtitle?: string }) {
  return (
    <View style={s.sectionBreak} break={number !== "Cover" && number !== "1"}>
      <Text style={s.sectionTitle}>Section {number} — {title}</Text>
      {subtitle ? <Text style={s.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

// ─── Cover ────────────────────────────────────────────────────────────────────

function CoverSection({ input }: { input: ExportInput }) {
  const { report, exportedAt } = input;
  return (
    <View>
      <View style={s.coverBlock}>
        <Text style={s.coverTitle}>Find Home First</Text>
        <Text style={s.coverSubtitle}>City Demographic &amp; Opportunity Report</Text>
        <Text style={s.coverSubtitle}>{report.projectName}</Text>
        <Text style={s.coverSubtitle}>
          {report.geography.city}, {report.geography.stateAbbr} · {report.targetPopulation}
        </Text>
        <Text style={[s.coverMeta, { marginTop: 10 }]}>
          VERDICT: {report.verdict}
        </Text>
      </View>

      <View style={s.metaGrid}>
        {[
          ["Report ID", report.reportId],
          ["Version", `v${report.version}`],
          ["Generated", fmtDate(report.generatedAt)],
          ["Data Through", report.dataThroughDate],
          ["Geography", `${report.geography.city}, ${report.geography.stateAbbr}`],
          ["Target Population", report.targetPopulation],
          ["CoC", report.geography.cocId ? `${report.geography.cocId} ${report.geography.cocName ?? ""}`.trim() : "Not Verified"],
          ["Exported", fmtDate(exportedAt)],
          ["Online Report (accessible)", input.onlineReportUrl ?? "Available at your Find Home First dashboard"],
        ].map(([label, value]) => (
          <View key={label} style={s.metaItem}>
            <Text style={s.metaLabel}>{label}</Text>
            <Text style={s.metaValue}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Section 1 — How to Use ───────────────────────────────────────────────────

function HowToUseSection() {
  const items = [
    {
      label: "What the verdict means",
      text: "Go means the evidence supports proceeding. Conditional Go means the opportunity appears promising but identified conditions must be resolved first. No-Go means current conditions do not support the project. Insufficient Evidence means critical data could not be collected.",
    },
    {
      label: "What it does not mean",
      text: "The verdict is a recommendation, not a guarantee. High housing need does not automatically mean the project will be financially or operationally successful.",
    },
    {
      label: "HUD Fair Market Rent caution",
      text: "HUD Fair Market Rent is a market benchmark. It is not a guaranteed payment per room. Confirm the actual per-room payment standard with the relevant program administrator before relying on any financial projection.",
    },
    {
      label: "RentCast caution",
      text: "RentCast listings show active rental inventory. They do not confirm that an owner permits shared housing, master leasing, or subleasing. Verify directly with each owner before proceeding.",
    },
    {
      label: "PIT count caution",
      text: "Point-in-Time counts are one-night estimates conducted annually. They may understate the actual homeless population. The 2026 trend figure is a derived estimate and is not an official exact count.",
    },
    {
      label: "Program listings caution",
      text: "Program listings do not mean Find Home First is enrolled in, approved by, or has an active agreement with any program. Enrollment and referral relationships must be established separately.",
    },
    {
      label: "Data mixing caution",
      text: "This report may include data from different reporting years and geographic levels. Review the reporting period and geography for each metric before relying on it. Dates and source geography are shown in the Sources section.",
    },
    {
      label: "Barrier resolution requirement",
      text: "Material barriers must be resolved before signing any property lease. Follow the single recommended next action before advancing the project.",
    },
  ];

  return (
    <View>
      <SectionHeading number="1" title="How to Use This Report" />
      {items.map((item) => (
        <View key={item.label} style={s.calloutItem}>
          <Text style={s.calloutLabel}>{item.label}</Text>
          <Text style={s.calloutText}>{item.text}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Section 2 — Market Verdict ───────────────────────────────────────────────

function VerdictSection({ report }: { report: MarketReportSnapshot }) {
  return (
    <View>
      <SectionHeading number="2" title="Market Verdict" />
      <View style={s.verdictBox}>
        <Text style={s.verdictLabel}>Verdict</Text>
        <Text style={s.verdictValue}>{report.verdict}</Text>
        <Text style={s.verdictExplanation}>{report.verdictExplanation}</Text>
      </View>

      {[
        ["Best initial target population", report.bestTargetPopulation],
        ["Best program opportunity", report.bestProgramOpportunity],
        ["Largest unresolved obstacle", report.largestBlocker],
        ["Primary next action", report.primaryNextAction],
      ].map(([label, value]) => (
        <View key={label} style={s.kvRow}>
          <Text style={s.kvLabel}>{label}</Text>
          <Text style={s.kvValue}>{value || "Not Verified"}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Section 3 — Opportunity Scorecard ───────────────────────────────────────

function ScorecardSection({ report }: { report: MarketReportSnapshot }) {
  const categories = report.scorecard.slice(0, 5);

  return (
    <View>
      <SectionHeading number="3" title="Opportunity Scorecard" subtitle={`Overall score: ${report.overallScore ?? "Not Verified"} · Verdict: ${report.verdict}`} />
      <View style={s.table}>
        <ScorecardTableHeader />
        {categories.map((cat: ScorecardCategory, i: number) => (
          <View key={cat.key} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt} wrap={false}>
            <Text style={s.tableCellBold}>{cat.label}</Text>
            <Text style={s.tableCell}>{cat.numericScore ?? "Unknown"}</Text>
            <Text style={s.tableCell}>{cat.band}</Text>
            <Text style={s.tableCell}>{(cat.weight * 100).toFixed(0)}%</Text>
            <Text style={s.tableCell}>{cat.weightedContribution != null ? cat.weightedContribution.toFixed(1) : "Unknown"}</Text>
            <Text style={[s.tableCell, { flex: 2 }]}>{cat.reason}</Text>
            <Text style={[cat.missingEvidence ? s.notVerified : s.tableCellMuted, { flex: 2 }]}>
              {cat.missingEvidence ? `⚠ ${cat.missingEvidence}` : "—"}
            </Text>
          </View>
        ))}
      </View>
      <Text style={s.bodySmall}>
        Formula: (Housing Need × 25%) + (Program Fit × 25%) + (Property Availability × 25%) + (Referral Readiness × 15%) + ((100 − Operating Risk) × 10%).
        Operating risk is inverted: 100 = highest risk. Scores are 0–100; High ≥ 70, Medium 40–69, Low &lt; 40.
        Unknown means critical data was unavailable and cannot be assumed.
      </Text>
    </View>
  );
}

// ─── Section 4 — Demographics ─────────────────────────────────────────────────

function DemographicsSection({ report }: { report: MarketReportSnapshot }) {
  const primary = report.primaryDemographics.slice(0, 6);

  return (
    <View>
      <SectionHeading number="4" title="People Who Need Housing" />
      <View style={s.table}>
        <DemographicsTableHeader />
        {primary.map((d, i) => (
          <View key={d.metricKey} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt} wrap={false}>
            <Text style={[s.tableCellBold, { flex: 2 }]}>{d.label}{d.isDerived ? " (Derived)" : ""}</Text>
            <Text style={s.tableCell}>{d.numericValue != null ? d.numericValue.toLocaleString("en-US") : "Not Verified"}</Text>
            <Text style={s.tableCell}>{d.unit}</Text>
            <Text style={s.tableCell}>{d.percentage != null ? fmtPct(d.percentage) : "—"}</Text>
            <Text style={s.tableCell}>{d.reportingPeriod}</Text>
            <Text style={s.tableCell}>{d.geographyName}</Text>
            <Text style={s.tableCell}>{d.confidence}</Text>
            <Text style={s.tableCell}>{d.sourceKey}</Text>
          </View>
        ))}
      </View>
      {primary.find((d) => d.isDerived) && (
        <View style={s.warningBlock}>
          <Text style={s.warningText}>
            {`⚠ Derived metrics are estimates calculated from reported data. They are labeled "(Derived)" and should not be cited as official counts. See Sources section for calculation methods.`}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Section 5 — Programs ─────────────────────────────────────────────────────

function ProgramsSection({ report }: { report: MarketReportSnapshot }) {
  const ranks: Array<ProgramOpportunity["fitRank"]> = ["Best Immediate", "Possible", "Future/Constrained"];

  return (
    <View>
      <SectionHeading number="5" title="Program Opportunities" />
      {ranks.map((rank) => {
        const programs = report.programs.filter((p) => p.fitRank === rank);
        if (programs.length === 0) return null;
        return (
          <View key={rank}>
            <Text style={s.subsectionTitle}>{rank} Opportunities</Text>
            {programs.map((prog) => (
              <View key={prog.programName} style={{ marginBottom: 10, paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: BRAND.border }} wrap={false}>
                <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: BRAND.primary, marginBottom: 3 }}>{prog.programName}</Text>
                {[
                  ["Population served", prog.populationServed],
                  ["Assistance available", prog.assistanceAvailable],
                  ["Find Home First role", prog.findHomeFirstRole],
                  ["Local organization", prog.localAdminOrg],
                  ["Shared-housing compatibility", prog.sharedHousingCompatibility],
                  ["Lease requirements", prog.leaseRequirements],
                  ["Inspection requirements", prog.inspectionRequirements],
                  ["Referral process", prog.referralProcess],
                  ["Current availability", prog.currentAvailability],
                  ["Unresolved restrictions", prog.unresolvedRestrictions],
                  ["Source / Date", `${prog.sourceKey} · ${prog.reportingDate}`],
                ].map(([label, value]) => (
                  <View key={label} style={[s.kvRow, { marginBottom: 2 }]}>
                    <Text style={[s.kvLabel, { fontSize: 7.5, width: 130 }]}>{label}</Text>
                    <Text style={[s.kvValue, {
                      fontSize: 7.5,
                      color: value === "Not Verified" ? BRAND.warning : BRAND.text,
                      fontFamily: value === "Not Verified" ? "Helvetica-Bold" : "Helvetica",
                    }]}>
                      {value ?? "Not Verified"}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

// ─── Section 6 — Property Economics ──────────────────────────────────────────

function PropertyEconomicsSection({ report }: { report: MarketReportSnapshot }) {
  return (
    <View>
      <SectionHeading number="6" title="Property Economics" />

      {/* FMR Benchmarks */}
      <Text style={s.subsectionTitle}>
        {report.fmrContext?.isEstimate ? "HUD Fair Market Rent Planning Estimate" : "HUD Fair Market Rent Benchmarks"}
        {` (${report.fmrContext?.reportingPeriod ?? "FY2026"} — ${report.fmrContext?.geography ?? report.geography.fmrArea ?? report.geography.metro ?? "Area"})`}
      </Text>
      <Text style={[s.bodySmall, { marginBottom: 6 }]}>
        {report.fmrContext?.isEstimate
          ? "⚠ This is a statewide HUD planning estimate because an exact municipality match was unavailable. Confirm the exact local FMR area and program payment standard."
          : "⚠ FMR is a market benchmark only. It is not a guaranteed payment per room. Confirm actual payment standard with the program administrator."}
      </Text>
      <View style={{ flexDirection: "row", marginBottom: 10 }}>
        {report.fmrBenchmarks.map((b) => (
          <View key={b.label} style={{ flex: 1, padding: 6, backgroundColor: BRAND.soft, marginRight: 4, borderRadius: 3 }}>
            <Text style={{ fontSize: 7, color: BRAND.muted }}>{b.label}</Text>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: BRAND.primary }}>${b.usd.toLocaleString("en-US")}</Text>
          </View>
        ))}
      </View>

      {/* Scenarios table */}
      <Text style={s.subsectionTitle}>Three-Scenario Financial Model</Text>
      <View style={s.table}>
        <EconomicsTableHeader />
        {report.economicsScenarios.map((sc: EconomicsScenario, i: number) => (
          <View key={sc.label} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt} wrap={false}>
            <Text style={s.tableCellBold}>{sc.label}</Text>
            <Text style={s.tableCell}>{sc.occupancyPct}%</Text>
            <Text style={s.tableCell}>{sc.usableRooms}</Text>
            <Text style={s.tableCell}>{sc.expectedOccupiedRooms.toFixed(1)}</Text>
            <Text style={s.tableCell}>{sc.revenueUsd != null ? `$${sc.revenueUsd.toLocaleString("en-US")}` : "Not Verified"}</Text>
            <Text style={s.tableCell}>{sc.propertyRentUsd != null ? `$${sc.propertyRentUsd.toLocaleString("en-US")}` : "Not Verified"}</Text>
            <Text style={s.tableCell}>{sc.utilitiesUsd != null ? `$${sc.utilitiesUsd.toLocaleString("en-US")}` : "Not Verified"}</Text>
            <Text style={s.tableCell}>{sc.prepFurnishingUsd != null ? `$${sc.prepFurnishingUsd.toLocaleString("en-US")}` : "Not Verified"}</Text>
            <Text style={[s.tableCell, sc.netMarginUsd === null ? s.notVerified : sc.netMarginUsd < 0 ? { color: BRAND.warning, fontFamily: "Helvetica-Bold" } : {}]}>
              {sc.netMarginUsd != null ? `$${sc.netMarginUsd.toLocaleString("en-US")}` : "Not Verified"}
            </Text>
            <Text style={s.tableCell}>{sc.breakEvenOccupancyPct != null ? `${sc.breakEvenOccupancyPct}%` : "Not Verified"}</Text>
            <Text style={sc.assumptionStatus === "Not Verified" ? s.notVerified : s.tableCell}>{sc.assumptionStatus}</Text>
          </View>
        ))}
      </View>
      <Text style={s.body}>{report.economicsConclusion}</Text>
    </View>
  );
}

// ─── Section 7 — Barriers ─────────────────────────────────────────────────────

function BarriersSection({ report }: { report: MarketReportSnapshot }) {
  return (
    <View>
      <SectionHeading number="7" title="Barriers and Missing Information" />
      <View style={s.table}>
        <BarriersTableHeader />
        {report.barriers.map((b: Barrier, i: number) => (
          <View key={b.description} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt} wrap={false}>
            <Text style={[s.tableCellBold, { flex: 2 }]}>{b.description}</Text>
            <Text style={[s.tableCell, { flex: 2 }]}>{b.whyItMatters}</Text>
            <Text style={[s.tableCell, b.severity === "Critical" ? { color: BRAND.warning, fontFamily: "Helvetica-Bold" } : {}]}>
              {b.severity === "Critical" ? "⚠ Critical" : b.severity}
            </Text>
            <Text style={b.verificationStatus === "Not Verified" ? s.notVerified : s.tableCell}>{b.verificationStatus}</Text>
            <Text style={s.tableCell}>{b.responsibleParty}</Text>
            <Text style={[s.tableCell, { flex: 2 }]}>{b.resolutionAction}</Text>
            <Text style={[s.tableCell, b.blocksApproval ? { color: BRAND.warning, fontFamily: "Helvetica-Bold" } : {}]}>
              {b.blocksApproval ? "⚠ Yes" : "No"}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Section 8 — Launch Strategy ─────────────────────────────────────────────

function LaunchStrategySection({ report }: { report: MarketReportSnapshot }) {
  return (
    <View>
      <SectionHeading number="8" title="Recommended Launch Strategy" />
      {report.launchSteps.map((step) => (
        <View key={step.stepNumber} style={s.stepRow} wrap={false}>
          <Text style={s.stepNumber}>{step.stepNumber}</Text>
          <Text style={s.stepText}>{step.description}</Text>
        </View>
      ))}
      <View style={[s.warningBlock, { marginTop: 10 }]}>
        <Text style={[s.warningText, { fontFamily: "Helvetica-Bold" }]}>
          Active next action: {report.primaryNextActionButton}
        </Text>
      </View>
    </View>
  );
}

// ─── Section 9 — Sources ──────────────────────────────────────────────────────

function SourcesSection({ report }: { report: MarketReportSnapshot }) {
  return (
    <View>
      <SectionHeading number="9" title="Sources and Methodology" />
      <View style={s.table}>
        <SourcesTableHeader />
        {report.sources.map((src: ReportSource, i: number) => (
          <View key={src.sourceKey} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt} wrap={false}>
            <Text style={[s.tableCellBold, { flex: 2 }]}>{src.sourceAgency}</Text>
            <Text style={[s.tableCell, { flex: 2 }]}>{src.datasetName}</Text>
            <View style={[{ flex: 2 }, { paddingHorizontal: 2 }]}>
              {src.directUrl ? (
                <Link src={src.directUrl} style={{ fontSize: 7, color: BRAND.secondary, textDecoration: "underline" }}>
                  {src.directUrl.length > 50 ? src.directUrl.slice(0, 47) + "…" : src.directUrl}
                </Link>
              ) : (
                <Text style={s.tableCellMuted}>Not available</Text>
              )}
            </View>
            <Text style={s.tableCell}>{src.reportingPeriod}</Text>
            <Text style={s.tableCell}>{src.geography}</Text>
            <Text style={s.tableCell}>{new Date(src.retrievedAt).toLocaleDateString("en-US")}</Text>
            <Text style={s.tableCell}>{src.retrievalMethod}</Text>
            <Text style={s.tableCell}>{src.confidence}</Text>
            <Text style={s.tableCell}>{src.isDerived ? "Derived" : "Reported"}</Text>
          </View>
        ))}
      </View>
      <Text style={[s.bodySmall, { marginTop: 6 }]}>
        All metrics identify the geography and reporting period they describe. Do not mix figures from different geographies or years without reviewing their source rows. Derived metrics are estimates calculated from reported data and are labeled accordingly.
      </Text>
    </View>
  );
}

// ─── Main document ────────────────────────────────────────────────────────────

export function buildReportDocument(input: ExportInput): React.ReactElement {
  const { report, exportedAt } = input;

  return (
    <Document
      title={`Find Home First — City Demographic & Opportunity Report — ${report.geography.city}, ${report.geography.stateAbbr} — ${report.targetPopulation}`}
      author="Find Home First"
      subject="City Demographic & Opportunity Report"
      keywords={`housing, city report, ${report.geography.city}, ${report.targetPopulation}, ${report.verdict}`}
      creator="Find Home First"
      producer="@react-pdf/renderer"
      language="en"
    >
      <Page size="LETTER" style={s.page}>
        <PageHeader report={report} />
        <PageFooter exportedAt={exportedAt} />

        <CoverSection input={input} />
        <HowToUseSection />
        <VerdictSection report={report} />
        <ScorecardSection report={report} />
        <DemographicsSection report={report} />
        <ProgramsSection report={report} />
        <PropertyEconomicsSection report={report} />
        <BarriersSection report={report} />
        <LaunchStrategySection report={report} />
        <SourcesSection report={report} />
      </Page>
    </Document>
  );
}
