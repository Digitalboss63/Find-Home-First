"use client";

import { useEffect, useState } from "react";
import type { DemographicMetric, MarketReportSnapshot } from "@/lib/export/types";

interface Props {
  projectId: string;
}

interface ReportResponse {
  report: MarketReportSnapshot | null;
}

const MAX_WAIT_ATTEMPTS = 24;
const RETRY_MS = 5000;

export function getVeteranNeedMetric(report: MarketReportSnapshot): DemographicMetric | null {
  const metrics = report.primaryDemographics.length > 0
    ? report.primaryDemographics
    : report.allDemographics;

  return metrics.find((metric) => metric.metricKey === "pit_veterans") ?? null;
}

export function VeteranNeedTargeting({ projectId }: Props) {
  const [report, setReport] = useState<MarketReportSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load(attempt: number) {
      try {
        const response = await fetch(
          `/api/projects/${projectId}/market-intelligence/report`,
          { cache: "no-store" }
        );

        if (!response.ok) return;

        const body = (await response.json()) as ReportResponse;
        if (cancelled) return;

        if (body.report) {
          setReport(body.report);
          return;
        }
      } catch {
        // The City Report owns user-facing fetch errors. This panel stays quiet.
      }

      if (!cancelled && attempt < MAX_WAIT_ATTEMPTS) {
        timer = setTimeout(() => void load(attempt + 1), RETRY_MS);
      }
    }

    void load(0);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [projectId]);

  if (!report) return null;

  const veteranMetric = getVeteranNeedMetric(report);
  if (!veteranMetric || veteranMetric.numericValue == null) return null;

  const pitSource = report.sources.find((source) => source.sourceKey === "hud_pit");
  const isEstimate = veteranMetric.isDerived;
  const geographyLabel = veteranMetric.geographyName || `${report.geography.city}, ${report.geography.stateAbbr}`;

  return (
    <section
      aria-labelledby="veteran-need-heading"
      style={{
        backgroundColor: "#F0FDF4",
        border: "1px solid #BBF7D0",
        borderRadius: "0.75rem",
        padding: "1.25rem 1.5rem",
        marginBottom: "1.25rem",
      }}
    >
      <p
        style={{
          margin: "0 0 0.25rem",
          color: "#166534",
          fontSize: "0.75rem",
          fontWeight: 800,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}
      >
        Veteran Housing Need
      </p>
      <h2
        id="veteran-need-heading"
        style={{
          margin: "0 0 0.5rem",
          color: "#173F5F",
          fontSize: "1.2rem",
          fontWeight: 800,
        }}
      >
        Where to look first: {geographyLabel}
      </h2>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem 2rem",
          alignItems: "baseline",
          marginBottom: "0.75rem",
        }}
      >
        <div>
          <div style={{ color: "#173F5F", fontSize: "1.75rem", fontWeight: 800, lineHeight: 1 }}>
            {veteranMetric.numericValue.toLocaleString()}
          </div>
          <div style={{ color: "#5C6773", fontSize: "0.8rem", marginTop: "0.2rem" }}>
            veterans experiencing homelessness{isEstimate ? " (estimated)" : ""}
          </div>
        </div>
        <div style={{ color: "#1F2933", fontSize: "0.82rem" }}>
          <strong>{veteranMetric.reportingPeriod}</strong>
          <br />
          {veteranMetric.confidence} confidence · {veteranMetric.geographyType.toUpperCase()} geography
        </div>
      </div>

      <p style={{ margin: "0 0 0.6rem", color: "#1F2933", fontSize: "0.84rem", lineHeight: 1.5 }}>
        Use this as the verified starting area for property search. FHF will not invent a ZIP-level concentration from broader HUD data. When a defensible smaller geography becomes available, the targeting can narrow automatically.
      </p>

      <p style={{ margin: 0, color: "#5C6773", fontSize: "0.75rem" }}>
        Source: {pitSource?.directUrl ? (
          <a
            href={pitSource.directUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#173F5F", fontWeight: 700 }}
          >
            {pitSource.datasetName}
          </a>
        ) : (
          pitSource?.datasetName ?? "HUD Point-in-Time Count"
        )}
        . Use the Find Properties action below to continue.
      </p>
    </section>
  );
}
