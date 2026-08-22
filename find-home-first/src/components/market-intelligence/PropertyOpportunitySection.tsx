"use client";

import React, { useState } from "react";
import type { ZipOpportunityRanking } from "@/lib/export/types";

// ── Design tokens (matching MarketReportView) ──────────────────────────────────
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
};

interface PropertyOpportunitySectionProps {
  rankings: ZipOpportunityRanking[];
  projectId: string;
  city?: string;
  stateAbbr?: string;
}

function priorityStyle(level: ZipOpportunityRanking["priorityLevel"]): React.CSSProperties {
  switch (level) {
    case "PRIORITY": return { backgroundColor: "#DCFCE7", color: "#166534", fontWeight: 700, fontSize: "0.7rem", padding: "0.15rem 0.45rem", borderRadius: "0.25rem", whiteSpace: "nowrap" };
    case "STRONG":   return { backgroundColor: "#FEF9C3", color: "#854D0E", fontWeight: 700, fontSize: "0.7rem", padding: "0.15rem 0.45rem", borderRadius: "0.25rem", whiteSpace: "nowrap" };
    case "WATCH":    return { backgroundColor: "#FEF3C7", color: "#92400E", fontWeight: 700, fontSize: "0.7rem", padding: "0.15rem 0.45rem", borderRadius: "0.25rem", whiteSpace: "nowrap" };
    case "LOW":      return { backgroundColor: "#F3F4F6", color: "#6B7280", fontWeight: 700, fontSize: "0.7rem", padding: "0.15rem 0.45rem", borderRadius: "0.25rem", whiteSpace: "nowrap" };
  }
}

function confidenceStyle(level: ZipOpportunityRanking["confidenceLevel"]): React.CSSProperties {
  switch (level) {
    case "HIGH":      return { backgroundColor: "#DCFCE7", color: "#166534", fontWeight: 600, fontSize: "0.7rem", padding: "0.15rem 0.45rem", borderRadius: "0.25rem", whiteSpace: "nowrap" };
    case "MEDIUM":    return { backgroundColor: "#FEF9C3", color: "#854D0E", fontWeight: 600, fontSize: "0.7rem", padding: "0.15rem 0.45rem", borderRadius: "0.25rem", whiteSpace: "nowrap" };
    case "ESTIMATED": return { backgroundColor: "#FED7AA", color: "#9A3412", fontWeight: 600, fontSize: "0.7rem", padding: "0.15rem 0.45rem", borderRadius: "0.25rem", whiteSpace: "nowrap" };
  }
}

function ScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
      <div style={{ flex: 1, height: "6px", backgroundColor: "#E5E7EB", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", backgroundColor: color, borderRadius: "3px" }} />
      </div>
      <span style={{ fontSize: "0.75rem", color: C.text, minWidth: "2.5rem", textAlign: "right" }}>
        {value.toFixed(1)}/{max}
      </span>
    </div>
  );
}

function ExpandedDetail({ r, projectId }: { r: ZipOpportunityRanking; projectId: string }) {
  const searchUrl = r.zipCode
    ? `/housing-search?project=${projectId}&zip=${encodeURIComponent(r.zipCode)}`
    : `/housing-search?project=${projectId}`;

  return (
    <div style={{ padding: "1rem 1.25rem", backgroundColor: "#F9FAFB", borderTop: `1px solid ${C.border}` }}>
      {/* Score breakdown */}
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: C.primary, marginBottom: "0.6rem" }}>Score Breakdown</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem 1.5rem" }}>
          <div>
            <div style={{ fontSize: "0.72rem", color: C.muted, marginBottom: "0.2rem" }}>Veteran Need (×0.40 → /40)</div>
            <ScoreBar value={r.veteranNeedScore} max={40} color={C.primary} />
          </div>
          <div>
            <div style={{ fontSize: "0.72rem", color: C.muted, marginBottom: "0.2rem" }}>Placement Infra (×0.20 → /20)</div>
            <ScoreBar value={r.placementInfraScore} max={20} color={C.secondary} />
          </div>
          <div>
            <div style={{ fontSize: "0.72rem", color: C.muted, marginBottom: "0.2rem" }}>Housing Economics (×0.25 → /25)</div>
            <ScoreBar value={r.housingEconomicsScore} max={25} color={C.action} />
          </div>
          <div>
            <div style={{ fontSize: "0.72rem", color: C.muted, marginBottom: "0.2rem" }}>Property Availability (×0.15 → /15)</div>
            <ScoreBar value={r.propertyAvailScore} max={15} color="#7C3AED" />
          </div>
        </div>
      </div>

      {/* Index values */}
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: C.primary, marginBottom: "0.4rem" }}>Sub-Indices (0–100)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.4rem", fontSize: "0.78rem" }}>
          <div><span style={{ color: C.muted }}>Vet Need: </span><strong>{r.veteranNeedIndex}</strong></div>
          <div><span style={{ color: C.muted }}>Infra: </span><strong>{r.placementInfraIndex}</strong></div>
          <div><span style={{ color: C.muted }}>Economics: </span><strong>{r.housingEconomicsIndex}</strong></div>
          <div><span style={{ color: C.muted }}>Properties: </span><strong>{r.propertyAvailIndex}</strong></div>
        </div>
      </div>

      {/* Data source */}
      <div style={{ marginBottom: "0.75rem" }}>
        <div style={{ fontSize: "0.72rem", color: C.muted }}>
          <strong>Source geography:</strong> {r.sourceGeography} ({r.sourceGeographyType})
          {r.isEstimated && <span style={{ marginLeft: "0.4rem", color: C.warning }}>⚠ Contains estimated inputs</span>}
        </div>
        <div style={{ fontSize: "0.72rem", color: C.muted, marginTop: "0.2rem" }}>
          <strong>Engine:</strong> {r.calculationVersion}
        </div>
      </div>

      {/* Recommendation */}
      <div style={{ backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "0.375rem", padding: "0.6rem 0.8rem", marginBottom: "0.75rem" }}>
        <div style={{ fontSize: "0.78rem", color: "#1E40AF", fontWeight: 600 }}>📋 Recommendation</div>
        <div style={{ fontSize: "0.8rem", color: "#1E3A8A", marginTop: "0.25rem" }}>{r.recommendation}</div>
      </div>

      {/* V1 limitation note */}
      {!r.zipCode && (
        <div style={{ backgroundColor: C.warnBg, border: `1px solid #FCD34D`, borderRadius: "0.375rem", padding: "0.5rem 0.75rem", marginBottom: "0.75rem" }}>
          <div style={{ fontSize: "0.75rem", color: C.warning, fontWeight: 600 }}>
            ⚠ V1 Limitation: Metro/CoC Level Only
          </div>
          <div style={{ fontSize: "0.75rem", color: "#78350F", marginTop: "0.2rem" }}>
            ZIP-level granularity is pending (HUD ZIP PIT, Census ZIP tabulation, SSVF ZIP map). This score reflects the entire metro/CoC area. Use the property search to find specific addresses.
          </div>
        </div>
      )}

      <a
        href={searchUrl}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.35rem",
          backgroundColor: C.action,
          color: "#fff",
          fontWeight: 600,
          fontSize: "0.82rem",
          padding: "0.45rem 1rem",
          borderRadius: "0.375rem",
          textDecoration: "none",
        }}
      >
        Find Properties →
      </a>
    </div>
  );
}

export function PropertyOpportunitySection({ rankings, projectId, city, stateAbbr }: PropertyOpportunitySectionProps) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const locationLabel = city && stateAbbr ? `${city}, ${stateAbbr}` : city ?? "this market";
  const searchBaseUrl = `/housing-search?project=${projectId}`;

  if (rankings.length === 0) {
    return (
      <div
        style={{
          backgroundColor: "#fff",
          border: `1px solid ${C.border}`,
          borderRadius: "0.75rem",
          padding: "1.25rem 1.5rem",
          marginBottom: "1.25rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", paddingBottom: "0.5rem", borderBottom: `1px solid ${C.border}` }}>
          <div>
            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: C.primary }}>
              Where Should We Look for Property?
            </div>
            <div style={{ fontSize: "0.72rem", color: C.muted, marginTop: "0.15rem" }}>Property Opportunity Engine V1</div>
          </div>
          <a
            href={searchBaseUrl}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              backgroundColor: C.action,
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.82rem",
              padding: "0.45rem 1rem",
              borderRadius: "0.375rem",
              textDecoration: "none",
            }}
          >
            Find Properties →
          </a>
        </div>
        <div style={{ backgroundColor: "#F9FAFB", border: `1px solid ${C.border}`, borderRadius: "0.5rem", padding: "1rem 1.25rem" }}>
          <p style={{ fontSize: "0.85rem", color: C.muted, margin: 0 }}>
            Property Opportunity data is not yet available for this report version. Regenerate the City Report to include opportunity rankings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "#fff",
        border: `1px solid ${C.border}`,
        borderRadius: "0.75rem",
        padding: "1.25rem 1.5rem",
        marginBottom: "1.25rem",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem", paddingBottom: "0.5rem", borderBottom: `1.5px solid ${C.primary}` }}>
        <div>
          <div style={{ fontSize: "1.05rem", fontWeight: 700, color: C.primary }}>
            Where Should We Look for Property?
          </div>
          <div style={{ fontSize: "0.72rem", color: C.muted, marginTop: "0.15rem" }}>
            Property Opportunity Engine V1 · {locationLabel}
          </div>
        </div>
        <a
          href={searchBaseUrl}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            backgroundColor: C.action,
            color: "#fff",
            fontWeight: 600,
            fontSize: "0.82rem",
            padding: "0.45rem 1rem",
            borderRadius: "0.375rem",
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          Find Properties →
        </a>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
          <thead>
            <tr>
              {["#", "Area", "Vet Need /40", "Infra /20", "Economics /25", "Properties /15", "Score /100", "Confidence", "Action"].map((h) => (
                <th
                  key={h}
                  style={{
                    backgroundColor: C.primary,
                    color: "#fff",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    padding: "0.4rem 0.6rem",
                    textAlign: "left",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rankings.map((r, i) => {
              const isExpanded = expandedRow === i;
              const rowBg = i % 2 === 0 ? "#fff" : "#F9FAFB";
              const searchUrl = r.zipCode
                ? `/housing-search?project=${projectId}&zip=${encodeURIComponent(r.zipCode)}`
                : `/housing-search?project=${projectId}`;
              const areaLabel = r.label || r.zipCode || r.sourceGeography;

              return (
                <React.Fragment key={i}>
                  <tr
                    onClick={() => setExpandedRow(isExpanded ? null : i)}
                    style={{ backgroundColor: rowBg, cursor: "pointer" }}
                  >
                    <td style={{ padding: "0.45rem 0.6rem", borderBottom: `0.5px solid ${C.border}`, color: C.muted, fontWeight: 600 }}>
                      {r.rank}
                    </td>
                    <td style={{ padding: "0.45rem 0.6rem", borderBottom: `0.5px solid ${C.border}` }}>
                      <div style={{ fontWeight: 600, color: C.text }}>{areaLabel}</div>
                      <div style={{ fontSize: "0.7rem", color: C.muted }}>{r.sourceGeography}</div>
                      <span style={priorityStyle(r.priorityLevel)}>{r.priorityLevel}</span>
                    </td>
                    <td style={{ padding: "0.45rem 0.6rem", borderBottom: `0.5px solid ${C.border}`, color: C.text }}>
                      {r.veteranNeedScore.toFixed(1)}
                    </td>
                    <td style={{ padding: "0.45rem 0.6rem", borderBottom: `0.5px solid ${C.border}`, color: C.text }}>
                      {r.placementInfraScore.toFixed(1)}
                    </td>
                    <td style={{ padding: "0.45rem 0.6rem", borderBottom: `0.5px solid ${C.border}`, color: C.text }}>
                      {r.housingEconomicsScore.toFixed(1)}
                    </td>
                    <td style={{ padding: "0.45rem 0.6rem", borderBottom: `0.5px solid ${C.border}`, color: C.text }}>
                      {r.propertyAvailScore.toFixed(1)}
                    </td>
                    <td style={{ padding: "0.45rem 0.6rem", borderBottom: `0.5px solid ${C.border}` }}>
                      <span style={{ fontSize: "1rem", fontWeight: 800, color: C.primary }}>{r.opportunityScore}</span>
                    </td>
                    <td style={{ padding: "0.45rem 0.6rem", borderBottom: `0.5px solid ${C.border}` }}>
                      <span style={confidenceStyle(r.confidenceLevel)}>
                        {r.confidenceLevel === "ESTIMATED" ? "⚠ " : ""}{r.confidenceLevel}
                      </span>
                    </td>
                    <td style={{ padding: "0.45rem 0.6rem", borderBottom: `0.5px solid ${C.border}` }}>
                      <a
                        href={searchUrl}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.2rem",
                          color: C.action,
                          fontWeight: 600,
                          fontSize: "0.78rem",
                          textDecoration: "none",
                          border: `1px solid ${C.action}`,
                          borderRadius: "0.25rem",
                          padding: "0.2rem 0.5rem",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Find Properties →
                      </a>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={9} style={{ padding: 0 }}>
                        <ExpandedDetail r={r} projectId={projectId} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Workflow guidance */}
      <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", backgroundColor: C.soft, borderRadius: "0.5rem", fontSize: "0.78rem", color: C.secondary }}>
        <strong>How to use this table:</strong> Click any row to see the full score breakdown and data sources.
        Higher scores indicate stronger opportunity. <strong>PRIORITY</strong> markets have the best combination of Veteran need, program infrastructure, and housing economics.
        Use <em>Find Properties →</em> to search for 4-bedroom rentals in that area.
        All scores are metro/CoC level in V1; ZIP-level granularity is on the roadmap.
      </div>
    </div>
  );
}

export default PropertyOpportunitySection;
