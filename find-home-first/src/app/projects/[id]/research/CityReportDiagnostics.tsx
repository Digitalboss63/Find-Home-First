"use client";

import { useEffect, useState } from "react";

interface DiagnosticResponse {
  report?: { analysisEngineVersion?: number } | null;
  sourcesSummary?: Record<string, string> | null;
  error?: string;
}

interface DiagnosticState {
  engineVersion?: number;
  zipStatus?: string;
  zipError?: string;
  censusStatus?: string;
  censusError?: string;
  loadError?: string;
}

export function CityReportDiagnostics({ projectId }: { projectId: string }) {
  const [diagnostic, setDiagnostic] = useState<DiagnosticState | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDiagnostic() {
      try {
        const res = await fetch(`/api/projects/${projectId}/market-intelligence/report`);
        const body = (await res.json()) as DiagnosticResponse;
        if (cancelled) return;

        if (!res.ok) {
          setDiagnostic({ loadError: body.error ?? `HTTP ${res.status}` });
          return;
        }

        const sources = body.sourcesSummary ?? {};
        setDiagnostic({
          engineVersion: body.report?.analysisEngineVersion,
          zipStatus: sources.zipDemographics,
          zipError: sources.zipDemographicsError,
          censusStatus: sources.census,
          censusError: sources.censusError,
        });
      } catch {
        if (!cancelled) setDiagnostic({ loadError: "Could not load report diagnostics." });
      }
    }

    void loadDiagnostic();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (!diagnostic) return null;

  const healthy = diagnostic.zipStatus === "ok" && !diagnostic.zipError;

  return (
    <div
      role="status"
      style={{
        marginBottom: "1rem",
        padding: "0.875rem 1rem",
        borderRadius: "0.65rem",
        border: healthy ? "1px solid #86EFAC" : "1px solid #F59E0B",
        backgroundColor: healthy ? "#F0FDF4" : "#FFFBEB",
        color: healthy ? "#166534" : "#92400E",
        fontSize: "0.825rem",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>City Report data check</div>
      {diagnostic.loadError ? (
        <div>{diagnostic.loadError}</div>
      ) : (
        <>
          <div>
            Report engine: <strong>{diagnostic.engineVersion ?? "unknown"}</strong> · ZIP Census: <strong>{diagnostic.zipStatus ?? "unknown"}</strong>
          </div>
          {diagnostic.zipError && <div style={{ marginTop: "0.25rem" }}>ZIP Census error: {diagnostic.zipError}</div>}
          {diagnostic.censusError && <div style={{ marginTop: "0.25rem" }}>City Census error: {diagnostic.censusError}</div>}
        </>
      )}
    </div>
  );
}
