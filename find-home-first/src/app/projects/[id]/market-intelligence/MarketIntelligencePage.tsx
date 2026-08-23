"use client";

/**
 * MarketIntelligencePage
 *
 * Client component — all interactivity lives here.
 *
 * On mount: fetches GET /api/projects/{id}/market-intelligence/report
 * Generate:  POST /api/projects/{id}/market-intelligence/run
 * Refresh:   same POST (cooldown enforced server-side)
 *
 * State machine:
 *   idle            → no report, no job
 *   loading         → initial fetch in progress
 *   no-report       → no completed report; show Generate button
 *   generating      → POST fired, polling every 4 s for up to 120 s
 *   complete        → report loaded; show view + export bar
 *   error           → terminal failure; show retry
 *
 * Version persistence: GET on mount always loads from PostgreSQL.
 * Version 2 does not overwrite version 1 — the server marks v1 superseded
 * but keeps the row; the UI shows the latest version number.
 */

import React, { useEffect, useRef, useState } from "react";
import type { MarketReportSnapshot } from "@/lib/export/types";
import { MarketReportView } from "@/components/market-intelligence/MarketReportView";
import { MarketReportExportBar } from "@/components/MarketReportExportBar";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReportApiResponse {
  report: MarketReportSnapshot | null;
  version?: number;
  generatedAt?: string;
  dataThroughDate?: string;
  jobStatus?: string | null;
  jobError?: string | null;
  sourcesSummary?: Record<string, string> | null;
  error?: string;
}

interface RunApiResponse {
  jobId?: string;
  reportId?: string;
  version?: number;
  verdict?: string;
  error?: string;
}

type PageState =
  | { kind: "loading" }
  | { kind: "no-report"; jobStatus?: string | null }
  | { kind: "generating"; attempt: number }
  | { kind: "complete"; snapshot: MarketReportSnapshot; version: number; generatedAt: string; sourcesSummary: Record<string, string> | null }
  | { kind: "error"; message: string; retryable: boolean };

// ── Constants ─────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 4000;
const MAX_POLL_ATTEMPTS = 30; // 120 s

// ── Styles ────────────────────────────────────────────────────────────────────

const C = { primary: "#173F5F", action: "#B45309", warning: "#7C2D12", border: "#CBD5D8", muted: "#5C6773" };

const cardStyle: React.CSSProperties = {
  backgroundColor: "#fff",
  border: `1px solid ${C.border}`,
  borderRadius: "0.75rem",
  padding: "2rem",
  textAlign: "center" as const,
  marginBottom: "1.25rem",
};

const btnPrimary: React.CSSProperties = {
  backgroundColor: C.primary,
  color: "#fff",
  border: "none",
  borderRadius: "0.5rem",
  padding: "0.625rem 1.5rem",
  fontSize: "0.9rem",
  fontWeight: 700,
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  backgroundColor: "#fff",
  color: C.primary,
  border: `1px solid ${C.border}`,
  borderRadius: "0.5rem",
  padding: "0.5rem 1.25rem",
  fontSize: "0.875rem",
  fontWeight: 600,
  cursor: "pointer",
};

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  projectId: string;
  projectName: string;
  community: string;
}

export function MarketIntelligencePage({ projectId, projectName, community }: Props) {
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [runError, setRunError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCountRef = useRef(0);
  const isMounted = useRef(true);
  const projectIdRef = useRef(projectId);

  // ── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  // ── Load report from PostgreSQL ─────────────────────────────────────────────
  // Defined as a plain async function, not in useCallback, to avoid lint's
  // react-hooks/set-state-in-effect rule which fires when setState is called
  // inside a useCallback-wrapped async function referenced from useEffect.
  async function loadReport() {
    try {
      const res = await fetch(`/api/projects/${projectIdRef.current}/market-intelligence/report`);
      if (!res.ok) {
        const body = await res.json() as ReportApiResponse;
        if (!isMounted.current) return;
        setState({ kind: "error", message: body.error ?? `HTTP ${res.status}`, retryable: true });
        return;
      }
      const body = await res.json() as ReportApiResponse;
      if (!isMounted.current) return;

      if (body.report && body.version && body.generatedAt) {
        setState({
          kind: "complete",
          snapshot: body.report,
          version: body.version,
          generatedAt: body.generatedAt,
          sourcesSummary: body.sourcesSummary ?? null,
        });
      } else {
        if (body.jobStatus === "running") {
          startPolling();
        } else {
          setState({ kind: "no-report", jobStatus: body.jobStatus });
        }
      }
    } catch {
      if (!isMounted.current) return;
      setState({ kind: "error", message: "Network error loading report.", retryable: true });
    }
  }

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    projectIdRef.current = projectId;
    void loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // ── Polling ─────────────────────────────────────────────────────────────────
  function startPolling(attempt = 0) {
    if (!isMounted.current) return;
    setState({ kind: "generating", attempt });
    pollCountRef.current = attempt;

    if (attempt >= MAX_POLL_ATTEMPTS) {
      setState({ kind: "error", message: "Report generation is taking longer than expected. Check back in a few minutes.", retryable: true });
      return;
    }

    pollRef.current = setTimeout(async () => {
      if (!isMounted.current) return;
      try {
        const res = await fetch(`/api/projects/${projectId}/market-intelligence/report`);
        if (!res.ok) { startPolling(attempt + 1); return; }
        const body = await res.json() as ReportApiResponse;
        if (body.report && body.version && body.generatedAt) {
          if (!isMounted.current) return;
          setState({
            kind: "complete",
            snapshot: body.report,
            version: body.version,
            generatedAt: body.generatedAt,
            sourcesSummary: body.sourcesSummary ?? null,
          });
        } else if (body.jobStatus === "failed") {
          if (!isMounted.current) return;
          setState({ kind: "error", message: body.jobError ?? "Report generation failed.", retryable: true });
        } else {
          startPolling(attempt + 1);
        }
      } catch {
        startPolling(attempt + 1);
      }
    }, POLL_INTERVAL_MS);
  }

  // ── Generate / Refresh ──────────────────────────────────────────────────────
  async function handleGenerate() {
    setRunError(null);
    if (pollRef.current) clearTimeout(pollRef.current);
    setState({ kind: "generating", attempt: 0 });
    pollCountRef.current = 0;

    try {
      const res = await fetch(`/api/projects/${projectId}/market-intelligence/run`, { method: "POST" });
      const body = await res.json() as RunApiResponse;

      if (!isMounted.current) return;

      if (res.status === 429 || res.status === 409) {
        // Cooldown or already running — just poll
        startPolling(0);
        return;
      }
      if (!res.ok) {
        setState({ kind: "error", message: body.error ?? `HTTP ${res.status}`, retryable: true });
        return;
      }

      // Run completed synchronously on the server — load the result
      await loadReport();
    } catch {
      if (!isMounted.current) return;
      setState({ kind: "error", message: "Network error — could not start report generation.", retryable: true });
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const reportUrl = typeof window !== "undefined"
    ? `${window.location.origin}/projects/${projectId}/market-intelligence`
    : `/projects/${projectId}/market-intelligence`;

  // Loading
  if (state.kind === "loading") {
    return (
      <div>
        <PageHeader projectName={projectName} community={community} />
        <div style={cardStyle}>
          <p style={{ color: C.muted, fontSize: "0.9rem" }}>Loading report…</p>
        </div>
      </div>
    );
  }

  // Generating (polling)
  if (state.kind === "generating") {
    const elapsed = Math.round((state.attempt * POLL_INTERVAL_MS) / 1000);
    return (
      <div>
        <PageHeader projectName={projectName} community={community} />
        <div style={cardStyle}>
          <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>⏳</div>
          <p style={{ fontWeight: 700, color: C.primary, marginBottom: "0.5rem" }}>
            Generating Market Intelligence Report…
          </p>
          <p style={{ color: C.muted, fontSize: "0.85rem" }}>
            Collecting data from HUD, Census, VA programs, and RentCast.
            {elapsed > 0 && ` (${elapsed}s elapsed)`}
          </p>
          <div style={{ marginTop: "1.25rem", height: "4px", borderRadius: "2px", backgroundColor: "#E2E8F0", overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${Math.min(95, (state.attempt / MAX_POLL_ATTEMPTS) * 100)}%`,
              backgroundColor: C.primary,
              transition: "width 0.5s ease",
            }} />
          </div>
        </div>
      </div>
    );
  }

  // No report yet
  if (state.kind === "no-report") {
    return (
      <div>
        <PageHeader projectName={projectName} community={community} />
        {runError && (
          <div role="alert" style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "0.5rem", padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: "0.875rem", color: "#991B1B" }}>
            {runError}
          </div>
        )}
        <div style={cardStyle}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📊</div>
          <p style={{ fontWeight: 700, color: C.primary, fontSize: "1.05rem", marginBottom: "0.5rem" }}>
            No Market Intelligence Report yet
          </p>
          <p style={{ color: C.muted, fontSize: "0.875rem", marginBottom: "1.5rem", maxWidth: "440px", margin: "0 auto 1.5rem" }}>
            Generate a report to see housing need, funding opportunities, property economics,
            and a recommended next action for {community}.
          </p>
          <button style={btnPrimary} onClick={() => void handleGenerate()}>
            Generate Report
          </button>
        </div>
      </div>
    );
  }

  // Error
  if (state.kind === "error") {
    return (
      <div>
        <PageHeader projectName={projectName} community={community} />
        <div style={{ ...cardStyle, borderColor: "#FECACA" }}>
          <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>⚠️</div>
          <p style={{ fontWeight: 700, color: C.warning, marginBottom: "0.5rem" }}>Report generation failed</p>
          <p style={{ color: C.muted, fontSize: "0.875rem", marginBottom: "1.25rem" }}>{state.message}</p>
          {state.retryable && (
            <button style={btnPrimary} onClick={() => void handleGenerate()}>
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  // Complete — show report + export bar + refresh
  const { snapshot, version, generatedAt, sourcesSummary } = state;
  const generatedDate = (() => {
    try { return new Date(generatedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); }
    catch { return generatedAt; }
  })();
  const zipDemographicsStatus = sourcesSummary?.zipDemographics ?? null;
  const zipDemographicsError = sourcesSummary?.zipDemographicsError ?? null;

  return (
    <div>
      <PageHeader projectName={projectName} community={community} />

      {/* Status bar — version, generated date, source health, refresh */}
      <div style={{
        display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap",
        padding: "0.625rem 1rem", backgroundColor: "#F8FAFC", border: `1px solid ${C.border}`,
        borderRadius: "0.5rem", marginBottom: "1rem", fontSize: "0.8rem",
      }}>
        <span style={{ color: C.primary, fontWeight: 700 }}>v{version}</span>
        <span style={{ color: C.muted }}>Engine v{snapshot.analysisEngineVersion ?? "?"}</span>
        <span style={{ color: C.muted }}>Generated {generatedDate}</span>
        {sourcesSummary && (
          <span style={{ color: C.muted }}>
            Sources: {Object.entries(sourcesSummary).map(([k, v]) =>
              <span key={k} style={{ marginRight: "0.5rem" }}>
                {k}: <span style={{ color: v === "ok" ? "#166534" : v === "partial" ? C.action : C.muted, fontWeight: 600 }}>{v}</span>
              </span>
            )}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button style={btnSecondary} onClick={() => void handleGenerate()}>
          ↻ Refresh Report
        </button>
      </div>

      {zipDemographicsStatus && zipDemographicsStatus !== "ok" && (
        <div
          role="alert"
          style={{
            backgroundColor: "#FFF7ED",
            border: "1px solid #FDBA74",
            borderRadius: "0.5rem",
            padding: "0.875rem 1rem",
            marginBottom: "1rem",
            color: C.warning,
            fontSize: "0.875rem",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: zipDemographicsError ? "0.35rem" : 0 }}>
            ZIP Census demographics: {zipDemographicsStatus}
          </div>
          {zipDemographicsError && <div>{zipDemographicsError}</div>}
        </div>
      )}

      {/* Export bar */}
      <MarketReportExportBar
        projectId={projectId}
        completedVersion={version}
        generatedAt={generatedAt}
        onlineReportUrl={reportUrl}
      />

      {/* Nine-section report */}
      <MarketReportView report={snapshot} />
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PageHeader({ projectName, community }: { projectName: string; community: string }) {
  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: C.primary, margin: "0 0 0.25rem" }}>
        Market Intelligence Report
      </h1>
      <p style={{ fontSize: "0.875rem", color: C.muted, margin: 0 }}>
        {projectName} · {community}
      </p>
    </div>
  );
}
