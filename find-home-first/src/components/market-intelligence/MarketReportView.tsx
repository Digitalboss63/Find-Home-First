"use client";

/**
 * Nine-section City Demographic & Opportunity Report display.
 * Renders a complete MarketReportSnapshot from the database.
 * Section order matches the export document.
 */

import React, { useState } from "react";
import type {
  MarketReportSnapshot,
  ScorecardCategory,
  DemographicMetric,
  ProgramOpportunity,
  EconomicsScenario,
  Barrier,
  ReportSource,
  LaunchStep,
} from "@/lib/export/types";
import { PropertyOpportunitySection } from "./PropertyOpportunitySection";

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  primary: "#173F5F",
  secondary: "#2F6F68",
  action: "#B45309",
  text: "#1F2933",
  muted: "#5C6773",
  border: "#CBD5D8",
  soft: "#E8F1EE",
  warning: "#7C2D12",
  warnBg: "#FEF3C7",
  critBg: "#FEF2F2",
  critBorder: "#FECACA",
  goBg: "#F0FDF4",
  goBorder: "#BBF7D0",
  goText: "#166534",
  condBg: "#FFFBEB",
  condBorder: "#FDE68A",
  condText: "#92400E",
  nogoBg: "#FEF2F2",
  nogoBorder: "#FECACA",
  nogoText: "#991B1B",
};

const card: React.CSSProperties = {
  backgroundColor: "#fff",
  border: `1px solid ${C.border}`,
  borderRadius: "0.75rem",
  padding: "1.25rem 1.5rem",
  marginBottom: "1.25rem",
};

const sectionH: React.CSSProperties = {
  fontSize: "1rem",
  fontWeight: 700,
  color: C.primary,
  margin: "0 0 1rem",
  paddingBottom: "0.5rem",
  borderBottom: `1px solid ${C.border}`,
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.72rem",
  fontWeight: 600,
  color: C.muted,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: "0.2rem",
};

const valueStyle: React.CSSProperties = { fontSize: "0.875rem", color: C.text };

const nvStyle: React.CSSProperties = { color: C.warning, fontWeight: 600 };

const tableHeader: React.CSSProperties = {
  backgroundColor: C.primary,
  color: "#fff",
  fontSize: "0.72rem",
  fontWeight: 700,
  padding: "0.4rem 0.5rem",
  textAlign: "left" as const,
};

const tableCell: React.CSSProperties = {
  fontSize: "0.8rem",
  color: C.text,
  padding: "0.4rem 0.5rem",
  borderBottom: `0.5px solid ${C.border}`,
  verticalAlign: "top" as const,
};

const tableCellAlt: React.CSSProperties = { ...tableCell, backgroundColor: "#F9FAFB" };

const nv = (v: string | number | null | undefined) =>
  v == null || v === "" ? <span style={nvStyle}>Not Verified</span> : String(v);

function SectionHeading({ n, title, sub }: { n: string; title: string; sub?: string }) {
  return (
    <div style={{ borderBottom: `1.5px solid ${C.primary}`, paddingBottom: "0.4rem", marginBottom: "1rem" }}>
      <div style={{ fontSize: "1.05rem", fontWeight: 700, color: C.primary }}>
        Section {n} — {title}
      </div>
      {sub && <div style={{ fontSize: "0.78rem", color: C.muted, marginTop: "0.2rem" }}>{sub}</div>}
    </div>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{ display: "flex", marginBottom: "0.375rem" }}>
      <div style={{ ...labelStyle, width: "12rem", flexShrink: 0 }}>{k}</div>
      <div style={valueStyle}>{v}</div>
    </div>
  );
}

function NotVerifiedPill() {
  return (
    <span
      style={{
        backgroundColor: C.warnBg,
        color: C.warning,
        fontWeight: 600,
        fontSize: "0.7rem",
        padding: "0.1rem 0.4rem",
        borderRadius: "0.25rem",
        whiteSpace: "nowrap",
      }}
    >
      NOT VERIFIED
    </span>
  );
}

function BandBadge({ band }: { band: "High" | "Medium" | "Low" | "Unknown" }) {
  const map: Record<string, { bg: string; color: string }> = {
    High: { bg: "#DCFCE7", color: "#166534" },
    Medium: { bg: "#FEF9C3", color: "#854D0E" },
    Low: { bg: "#FEE2E2", color: "#991B1B" },
    Unknown: { bg: "#F3F4F6", color: "#6B7280" },
  };
  const s = map[band] ?? map["Unknown"];
  return (
    <span
      style={{
        backgroundColor: s.bg,
        color: s.color,
        fontWeight: 700,
        fontSize: "0.7rem",
        padding: "0.15rem 0.45rem",
        borderRadius: "0.25rem",
      }}
    >
      {band}
    </span>
  );
}

// ── Section 1: Cover ────────────────────────────────────────────────────────────
function Section1Cover({ r }: { r: MarketReportSnapshot }) {
  return (
    <div style={card}>
      <SectionHeading n="1" title="Report Overview" sub="City Demographic & Opportunity Report" />
      <KV k="Project" v={r.projectName} />
      <KV k="Geography" v={`${r.geography.city}, ${r.geography.stateAbbr}`} />
      {r.geography.county && <KV k="County" v={r.geography.county} />}
      {r.geography.metro && <KV k="MSA" v={r.geography.metro} />}
      {r.geography.cocId && <KV k="CoC" v={`${r.geography.cocId} — ${r.geography.cocName ?? ""}`} />}
      {r.geography.phaName && <KV k="PHA" v={r.geography.phaName} />}
      <KV k="Target Population" v={r.targetPopulation} />
      <KV k="Version" v={`v${r.version}`} />
      <KV k="Generated" v={new Date(r.generatedAt).toLocaleDateString()} />
      <KV k="Data Through" v={r.dataThroughDate} />
    </div>
  );
}

// ── Section 2: Verdict ──────────────────────────────────────────────────────────
function Section2Verdict({ r }: { r: MarketReportSnapshot }) {
  const verdictStyle: Record<string, { bg: string; border: string; text: string }> = {
    "Go": { bg: C.goBg, border: C.goBorder, text: C.goText },
    "Conditional Go": { bg: C.condBg, border: C.condBorder, text: C.condText },
    "No-Go": { bg: C.nogoBg, border: C.nogoBorder, text: C.nogoText },
    "Insufficient Evidence": { bg: "#F9FAFB", border: C.border, text: C.muted },
  };
  const vs = verdictStyle[r.verdict] ?? verdictStyle["Insufficient Evidence"];

  return (
    <div style={card}>
      <SectionHeading n="2" title="Market Verdict" />
      <div
        style={{
          backgroundColor: vs.bg,
          border: `1.5px solid ${vs.border}`,
          borderRadius: "0.5rem",
          padding: "0.75rem 1rem",
          marginBottom: "1rem",
        }}
      >
        <div style={{ fontSize: "1.25rem", fontWeight: 800, color: vs.text }}>{r.verdict}</div>
        <div style={{ fontSize: "0.85rem", color: C.text, marginTop: "0.35rem" }}>{r.verdictExplanation}</div>
      </div>
      <KV k="Overall Score" v={r.overallScore != null ? `${r.overallScore}/100` : nv(null)} />
      <KV k="Confidence" v={r.confidence} />
      <KV k="Best Population" v={r.bestTargetPopulation} />
      <KV k="Best Program" v={r.bestProgramOpportunity} />
      <KV k="Largest Blocker" v={r.largestBlocker} />
      <div
        style={{
          marginTop: "1rem",
          backgroundColor: C.warnBg,
          border: `1px solid #FDE68A`,
          borderRadius: "0.5rem",
          padding: "0.6rem 0.9rem",
          fontSize: "0.8rem",
          color: C.action,
          fontWeight: 600,
        }}
      >
        Next Action: {r.primaryNextAction}
      </div>
    </div>
  );
}

// ── Section 3: Scorecard ────────────────────────────────────────────────────────
function Section3Scorecard({ r }: { r: MarketReportSnapshot }) {
  return (
    <div style={card}>
      <SectionHeading n="3" title="Market Scorecard" sub="Weighted scoring across five dimensions" />
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Category", "Score", "Band", "Weight", "Contribution", "Reason"].map((h) => (
              <th key={h} style={tableHeader}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {r.scorecard.map((item: ScorecardCategory, i) => {
            const cell = i % 2 === 0 ? tableCell : tableCellAlt;
            return (
              <tr key={item.key}>
                <td style={cell}>{item.label}</td>
                <td style={cell}>{item.numericScore ?? "—"}</td>
                <td style={cell}><BandBadge band={item.band} /></td>
                <td style={cell}>{Math.round(item.weight * 100)}%</td>
                <td style={cell}>{item.weightedContribution != null ? item.weightedContribution.toFixed(1) : "—"}</td>
                <td style={{ ...cell, maxWidth: "18rem" }}>
                  {item.reason}
                  {item.missingEvidence && (
                    <div style={{ color: C.warning, fontSize: "0.72rem", marginTop: "0.2rem" }}>
                      Missing: {item.missingEvidence}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Section 4: Demographics ─────────────────────────────────────────────────────
function Section4Demographics({ r }: { r: MarketReportSnapshot }) {
  const metrics = r.primaryDemographics.length > 0 ? r.primaryDemographics : r.allDemographics;
  return (
    <div style={card}>
      <SectionHeading n="4" title="Population Demographics" sub="HUD PIT count and Census ACS data" />
      {metrics.length === 0 ? (
        <div style={{ color: C.muted, fontSize: "0.875rem" }}>No demographic data collected.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Metric", "Value", "Geography", "Period", "Confidence"].map((h) => (
                <th key={h} style={tableHeader}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((m: DemographicMetric, i) => {
              const cell = i % 2 === 0 ? tableCell : tableCellAlt;
              const displayVal = m.numericValue != null
                ? m.numericValue.toLocaleString() + (m.percentage != null ? ` (${(m.percentage * 100).toFixed(1)}%)` : "")
                : (m.textValue ?? "—");
              return (
                <tr key={m.metricKey}>
                  <td style={cell}>
                    {m.label}
                    {m.isDerived && <span style={{ color: C.muted, fontSize: "0.7rem" }}> (est.)</span>}
                  </td>
                  <td style={cell}>
                    {displayVal}
                    {m.comparisonPopulation && (
                      <div style={{ color: C.muted, fontSize: "0.7rem" }}>{m.comparisonPopulation}</div>
                    )}
                  </td>
                  <td style={cell}>{m.geographyName}</td>
                  <td style={cell}>{m.reportingPeriod}</td>
                  <td style={cell}>{m.confidence}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Section 5: Programs ─────────────────────────────────────────────────────────
function Section5Programs({ r }: { r: MarketReportSnapshot }) {
  const fitColors: Record<string, string> = {
    "Best Immediate": "#166534",
    "Possible": "#854D0E",
    "Future/Constrained": "#991B1B",
  };

  return (
    <div style={card}>
      <SectionHeading n="5" title="Program & Funding Opportunities" sub="VA and local CoC programs" />
      {r.programs.map((p: ProgramOpportunity, i) => (
        <div
          key={i}
          style={{
            border: `1px solid ${C.border}`,
            borderRadius: "0.5rem",
            padding: "0.75rem 1rem",
            marginBottom: "0.75rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <span style={{ fontWeight: 700, fontSize: "0.9rem", color: C.primary }}>{p.programName}</span>
            <span style={{ color: fitColors[p.fitRank] ?? C.muted, fontWeight: 700, fontSize: "0.72rem" }}>
              {p.fitRank}
            </span>
          </div>
          <KV k="Population" v={p.populationServed} />
          <KV k="Assistance" v={p.assistanceAvailable} />
          <KV k="FHF Role" v={p.findHomeFirstRole} />
          <KV k="Local Admin" v={nv(p.localAdminOrg)} />
          <KV k="Shared Housing" v={p.sharedHousingCompatibility.includes("Not Verified") ? <NotVerifiedPill /> : p.sharedHousingCompatibility} />
          <KV k="Lease Requirements" v={p.leaseRequirements?.includes("Not Verified") ? <NotVerifiedPill /> : nv(p.leaseRequirements)} />
          <KV k="Inspection" v={p.inspectionRequirements?.includes("Not Verified") ? <NotVerifiedPill /> : nv(p.inspectionRequirements)} />
          <KV k="Referral Process" v={p.referralProcess?.includes("Not Verified") ? <NotVerifiedPill /> : nv(p.referralProcess)} />
          <KV k="Availability" v={p.currentAvailability} />
          {p.unresolvedRestrictions && (
            <KV
              k="Restrictions"
              v={<span style={{ color: C.warning, fontSize: "0.8rem" }}>{p.unresolvedRestrictions}</span>}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Section 6: Economics ────────────────────────────────────────────────────────
function Section6Economics({ r }: { r: MarketReportSnapshot }) {
  return (
    <div style={card}>
      <SectionHeading n="6" title="Property Economics" sub="FMR benchmarks and scenario modeling" />

      {/* FMR table */}
      {r.fmrBenchmarks.length > 0 && (
        <>
          <div style={{ ...sectionH, fontSize: "0.85rem" }}>
            {r.fmrContext?.isEstimate ? "HUD Fair Market Rent Planning Estimate" : "HUD Fair Market Rents"}
          </div>
          {r.fmrContext && (
            <div style={{ marginBottom: "0.65rem", color: r.fmrContext.isEstimate ? C.warning : C.muted, fontSize: "0.78rem" }}>
              {r.fmrContext.geography} · {r.fmrContext.reportingPeriod}
              {r.fmrContext.isEstimate ? " · Area estimate—not an exact local payment standard" : " · Published benchmark—not a guaranteed payment standard"}
            </div>
          )}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "1rem" }}>
            <thead>
              <tr>
                {r.fmrBenchmarks.map((b) => (
                  <th key={b.label} style={tableHeader}>{b.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {r.fmrBenchmarks.map((b, i) => (
                  <td key={b.label} style={i % 2 === 0 ? tableCell : tableCellAlt}>
                    ${b.usd.toLocaleString()}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </>
      )}

      {/* Scenarios */}
      <div style={{ ...sectionH, fontSize: "0.85rem" }}>Scenarios</div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "1rem" }}>
        <thead>
          <tr>
            {["Scenario", "Occupancy", "Rooms", "Revenue", "Status"].map((h) => (
              <th key={h} style={tableHeader}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {r.economicsScenarios.map((s: EconomicsScenario, i) => {
            const cell = i % 2 === 0 ? tableCell : tableCellAlt;
            return (
              <tr key={s.label}>
                <td style={cell}>{s.label}</td>
                <td style={cell}>{s.occupancyPct}%</td>
                <td style={cell}>{s.expectedOccupiedRooms} / {s.usableRooms}</td>
                <td style={cell}>{s.revenueUsd != null ? `$${s.revenueUsd.toLocaleString()}` : <NotVerifiedPill />}</td>
                <td style={cell}>{s.assumptionStatus}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div
        style={{
          backgroundColor: C.soft,
          border: `1px solid ${C.secondary}`,
          borderRadius: "0.5rem",
          padding: "0.65rem 0.9rem",
          fontSize: "0.82rem",
          color: C.text,
        }}
      >
        {r.economicsConclusion}
      </div>
    </div>
  );
}

// ── Section 7: Barriers ─────────────────────────────────────────────────────────
function Section7Barriers({ r }: { r: MarketReportSnapshot }) {
  const critical = r.barriers.filter((b) => b.severity === "Critical");
  const other = r.barriers.filter((b) => b.severity !== "Critical");

  const BarrierCard = ({ b }: { b: Barrier }) => (
    <div
      style={{
        border: `1px solid ${b.severity === "Critical" ? C.critBorder : C.border}`,
        borderRadius: "0.5rem",
        padding: "0.75rem 1rem",
        marginBottom: "0.6rem",
        backgroundColor: b.severity === "Critical" ? C.critBg : "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
        {b.severity === "Critical" && (
          <span style={{ color: C.warning, fontWeight: 800, fontSize: "0.72rem" }}>⚠ CRITICAL</span>
        )}
        <span style={{ fontWeight: 700, fontSize: "0.85rem", color: C.text }}>{b.description}</span>
        {b.blocksApproval && (
          <span style={{ color: C.warning, fontSize: "0.7rem", fontWeight: 600 }}>Blocks Approval</span>
        )}
      </div>
      <KV k="Why It Matters" v={b.whyItMatters} />
      <KV k="Status" v={b.verificationStatus === "Not Verified" ? <NotVerifiedPill /> : b.verificationStatus} />
      <KV k="Responsible" v={b.responsibleParty} />
      <KV k="Resolution" v={b.resolutionAction} />
    </div>
  );

  return (
    <div style={card}>
      <SectionHeading n="7" title="Risks & Barriers" sub="Items that must be resolved before proceeding" />
      {critical.map((b, i) => <BarrierCard key={i} b={b} />)}
      {other.map((b, i) => <BarrierCard key={`o-${i}`} b={b} />)}
      {r.barriers.length === 0 && <div style={{ color: C.muted, fontSize: "0.875rem" }}>No barriers identified.</div>}
    </div>
  );
}

// ── Section 8: Launch Strategy ─────────────────────────────────────────────────
function Section8Launch({ r }: { r: MarketReportSnapshot }) {
  return (
    <div style={card}>
      <SectionHeading n="8" title="Launch Strategy" sub="Recommended steps to activate this market" />
      <div style={{ marginBottom: "1rem" }}>
        {r.launchSteps.map((s: LaunchStep) => (
          <div
            key={s.stepNumber}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              marginBottom: "0.6rem",
            }}
          >
            <div
              style={{
                backgroundColor: C.primary,
                color: "#fff",
                borderRadius: "50%",
                width: "1.4rem",
                height: "1.4rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "0.72rem",
                flexShrink: 0,
              }}
            >
              {s.stepNumber}
            </div>
            <div style={{ fontSize: "0.875rem", color: C.text, paddingTop: "0.1rem" }}>{s.description}</div>
          </div>
        ))}
      </div>
      <div
        style={{
          backgroundColor: C.warnBg,
          border: `1px solid #FDE68A`,
          borderRadius: "0.5rem",
          padding: "0.6rem 0.9rem",
          fontSize: "0.82rem",
          color: C.action,
          fontWeight: 600,
        }}
      >
        Primary Next Action: {r.primaryNextAction}
      </div>
    </div>
  );
}

// ── Section 9: Sources ─────────────────────────────────────────────────────────
function Section9Sources({ r }: { r: MarketReportSnapshot }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={card}>
      <SectionHeading n="9" title="Data Sources" sub="Provenance and confidence for all data" />
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: "none",
          border: `1px solid ${C.border}`,
          borderRadius: "0.375rem",
          padding: "0.3rem 0.7rem",
          cursor: "pointer",
          fontSize: "0.8rem",
          color: C.primary,
          marginBottom: "0.75rem",
        }}
      >
        {expanded ? "Hide sources" : `Show ${r.sources.length} sources`}
      </button>
      {expanded && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Source", "Agency", "Period", "Geography", "Method", "Confidence"].map((h) => (
                <th key={h} style={tableHeader}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {r.sources.map((s: ReportSource, i) => {
              const cell = i % 2 === 0 ? tableCell : tableCellAlt;
              return (
                <tr key={s.sourceKey}>
                  <td style={cell}>
                    {s.directUrl ? (
                      <a href={s.directUrl} target="_blank" rel="noopener noreferrer" style={{ color: C.primary }}>
                        {s.datasetName}
                      </a>
                    ) : (
                      s.datasetName
                    )}
                  </td>
                  <td style={cell}>{s.sourceAgency}</td>
                  <td style={cell}>{s.reportingPeriod}</td>
                  <td style={cell}>{s.geography}</td>
                  <td style={cell}>{s.retrievalMethod}</td>
                  <td style={cell}>{s.confidence}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
interface MarketReportViewProps {
  report: MarketReportSnapshot;
  version?: number;
  generatedAt?: string;
  dataThroughDate?: string;
}

export function MarketReportView({ report: r, version, generatedAt, dataThroughDate }: MarketReportViewProps) {
  void version; void generatedAt; void dataThroughDate;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: "64rem", margin: "0 auto", padding: "1rem" }}>
      {/* Disclaimer banner */}
      <div
        style={{
          backgroundColor: C.warnBg,
          border: `1.5px solid #FCD34D`,
          borderRadius: "0.5rem",
          padding: "0.65rem 1rem",
          marginBottom: "1.25rem",
          fontSize: "0.8rem",
          color: C.warning,
          fontWeight: 600,
        }}
      >
        {`⚠ This is an automated city report. All data marked "Not Verified" requires direct confirmation with the relevant program administrator before making any operational decision.`}
      </div>

      <PropertyOpportunitySection
        rankings={r.opportunityRankings ?? []}
        projectId={r.projectId}
        city={r.geography.city}
        stateAbbr={r.geography.stateAbbr}
      />
      <Section1Cover r={r} />
      <Section2Verdict r={r} />
      <Section3Scorecard r={r} />
      <Section4Demographics r={r} />
      <Section5Programs r={r} />
      <Section6Economics r={r} />
      <Section7Barriers r={r} />
      <Section8Launch r={r} />
      <Section9Sources r={r} />
    </div>
  );
}

export default MarketReportView;
