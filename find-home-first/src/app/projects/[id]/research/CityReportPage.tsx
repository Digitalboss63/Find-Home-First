"use client";

/**
 * CityReportPage
 *
 * Client component — all interactivity lives here.
 *
 * On mount: fetches GET /api/projects/{id}/market-intelligence/report
 * Generate:  POST /api/projects/{id}/market-intelligence/run
 *
 * States shown to the user:
 *   loading    → invisible (avoids flicker for fast responses)
 *   no-report  → "Generate City Report" prompt
 *   preparing  → "Preparing your city report…"
 *   complete   → report body + export bar + "Proceed to Find Properties"
 *   error      → plain message + Try Again
 *
 * Technical concepts deliberately hidden from normal users:
 *   - job queue, collector names, API status, snapshot internals,
 *     database version mechanics, polling terminology.
 *
 * Versioning is maintained internally by the backend for audit and
 * export accuracy; it is not surfaced as a user-facing workflow here.
 */

import React, { useEffect, useRef, useState, useTransition } from "react";
import type { MarketReportSnapshot } from "@/lib/export/types";
import { MarketReportView } from "@/components/market-intelligence/MarketReportView";
import { MarketReportExportBar } from "@/components/MarketReportExportBar";
import { proceedToFindPropertiesAction } from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReportApiResponse {
  report: MarketReportSnapshot | null;
  version?: number;
  generatedAt?: string;
  needsUpdate?: boolean;
  jobStatus?: string | null;
  jobError?: string | null;
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
  | { kind: "no-report" }
  | { kind: "preparing"; attempt: number }
  | { kind: "complete"; snapshot: MarketReportSnapshot; version: number; generatedAt: string; needsUpdate: boolean }
  | { kind: "error"; message: string; retryable: boolean };

// ── Constants ─────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 4000;
const MAX_POLL_ATTEMPTS = 30; // 120 s max

// ── Statuses at which property search is already accessible ──────────────────

const ALREADY_ELIGIBLE = new Set([
  "city_approved",
  "finding_property",
  "contacting_owner",
  "application_in_progress",
  "property_approved",
  "preparing_property",
  "seeking_referrals",
  "reviewing_resident",
  "placement_approved",
]);

// ── Styles ────────────────────────────────────────────────────────────────────

const C = {
  primary: "#173F5F",
  action: "#B45309",
  border: "#CBD5D8",
  muted: "#5C6773",
  warning: "#7C2D12",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#fff",
  border: `1px solid ${C.border}`,
  borderRadius: "0.75rem",
  padding: "2rem",
  textAlign: "center",
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

const btnProceed: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.5rem",
  backgroundColor: "#16a34a",
  color: "#fff",
  border: "none",
  borderRadius: "0.5rem",
  padding: "0.75rem 1.5rem",
  fontSize: "0.95rem",
  fontWeight: 700,
  cursor: "pointer",
};

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  projectId: string;
  projectName: string;
  community: string;
  currentStatus: string;
}

export function CityReportPage({ projectId, projectName, community, currentStatus }: Props) {
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [runError, setRunError] = useState<string | null>(null);
  const [proceedError, setProceedError] = useState<string | null>(null);
  const [isProceedPending, startProceedTransition] = useTransition();

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);
  const projectIdRef = useRef(projectId);

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  // ── Load report ──────────────────────────────────────────────────────────────
  async function loadReport() {
    try {
      const res = await fetch(
        `/api/projects/${projectIdRef.current}/market-intelligence/report`
      );
      if (!res.ok) {
        const body = (await res.json()) as ReportApiResponse;
        if (!isMounted.current) return;
        setState({
          kind: "error",
          message: body.error ?? `Could not load report (HTTP ${res.status}).`,
          retryable: true,
        });
        return;
      }
      const body = (await res.json()) as ReportApiResponse;
      if (!isMounted.current) return;

      if (body.report && body.version && body.generatedAt) {
        setState({
          kind: "complete",
          snapshot: body.report,
          version: body.version,
          generatedAt: body.generatedAt,
          needsUpdate: body.needsUpdate === true,
        });
      } else if (body.jobStatus === "running") {
        startPolling(0);
      } else {
        setState({ kind: "no-report" });
      }
    } catch {
      if (!isMounted.current) return;
      setState({ kind: "error", message: "Network error — could not load report.", retryable: true });
    }
  }

  useEffect(() => {
    projectIdRef.current = projectId;
    void loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // ── Polling ──────────────────────────────────────────────────────────────────
  function startPolling(attempt: number) {
    if (!isMounted.current) return;
    setState({ kind: "preparing", attempt });

    if (attempt >= MAX_POLL_ATTEMPTS) {
      setState({
        kind: "error",
        message:
          "Report preparation is taking longer than expected. Check back in a few minutes.",
        retryable: true,
      });
      return;
    }

    pollRef.current = setTimeout(async () => {
      if (!isMounted.current) return;
      try {
        const res = await fetch(
          `/api/projects/${projectId}/market-intelligence/report`
        );
        if (!res.ok) {
          startPolling(attempt + 1);
          return;
        }
        const body = (await res.json()) as ReportApiResponse;
        if (body.report && body.version && body.generatedAt) {
          if (!isMounted.current) return;
          setState({
            kind: "complete",
            snapshot: body.report,
            version: body.version,
            generatedAt: body.generatedAt,
            needsUpdate: body.needsUpdate === true,
          });
        } else if (body.jobStatus === "failed") {
          if (!isMounted.current) return;
          setState({
            kind: "error",
            message: body.jobError ?? "Report preparation failed.",
            retryable: true,
          });
        } else {
          startPolling(attempt + 1);
        }
      } catch {
        startPolling(attempt + 1);
      }
    }, POLL_INTERVAL_MS);
  }

  // ── Generate / Update ────────────────────────────────────────────────────────
  async function handleGenerate() {
    const previousComplete = state.kind === "complete" ? state : null;
    setRunError(null);
    setProceedError(null);
    if (pollRef.current) clearTimeout(pollRef.current);
    setState({ kind: "preparing", attempt: 0 });

    try {
      const res = await fetch(
        `/api/projects/${projectId}/market-intelligence/run`,
        { method: "POST" }
      );
      const body = (await res.json()) as RunApiResponse;
      if (!isMounted.current) return;

      if (res.status === 409) {
        startPolling(0);
        return;
      }
      if (res.status === 429) {
        if (previousComplete) {
          setState(previousComplete);
          setRunError(body.error ?? "This report was updated recently. Please try again shortly.");
        } else {
          setState({
            kind: "error",
            message: body.error ?? "This report was updated recently. Please try again shortly.",
            retryable: true,
          });
        }
        return;
      }
      if (!res.ok) {
        setState({
          kind: "error",
          message: body.error ?? "Could not start report preparation.",
          retryable: true,
        });
        return;
      }

      await loadReport();
    } catch {
      if (!isMounted.current) return;
      setState({
        kind: "error",
        message: "Network error — could not start report preparation.",
        retryable: true,
      });
    }
  }

  // ── Proceed to Find Properties ───────────────────────────────────────────────
  function handleProceed() {
    setProceedError(null);
    startProceedTransition(async () => {
      const result = await proceedToFindPropertiesAction(projectId);
      // If result is returned (not redirected), it contains an error.
      if (result && "error" in result) {
        setProceedError(result.error);
      }
      // On success: server action calls redirect() — no client code needed.
    });
  }

  // ── Derive whether the project is already eligible ──────────────────────────
  const alreadyEligible = ALREADY_ELIGIBLE.has(currentStatus);

  // ── Header ───────────────────────────────────────────────────────────────────
  const header = (
    <div style={{ marginBottom: "1.25rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: C.primary, margin: "0 0 0.25rem" }}>
        City Demographic &amp; Opportunity Report
      </h1>
      <p style={{ fontSize: "0.875rem", color: C.muted, margin: 0 }}>
        {projectName} &middot; {community}
      </p>
    </div>
  );

  // ── States ───────────────────────────────────────────────────────────────────

  if (state.kind === "loading") {
    // Show nothing during initial fetch to avoid flicker
    return (
      <div>
        {header}
        <div style={{ ...cardStyle, minHeight: "10rem" }} aria-live="polite" aria-busy="true" />
      </div>
    );
  }

  if (state.kind === "no-report") {
    return (
      <div>
        {header}
        {runError && (
          <div
            role="alert"
            style={{
              backgroundColor: "#FEF2F2",
              border: "1px solid #FECACA",
              borderRadius: "0.5rem",
              padding: "0.75rem 1rem",
              marginBottom: "1rem",
              fontSize: "0.875rem",
              color: "#991B1B",
            }}
          >
            {runError}
          </div>
        )}
        <div style={cardStyle}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📋</div>
          <p
            style={{
              fontWeight: 700,
              color: C.primary,
              fontSize: "1.05rem",
              marginBottom: "0.5rem",
            }}
          >
            No city report yet
          </p>
          <p
            style={{
              color: C.muted,
              fontSize: "0.875rem",
              marginBottom: "1.5rem",
              maxWidth: "440px",
              margin: "0 auto 1.5rem",
            }}
          >
            Generate a report to see housing need, funding opportunities, and
            property conditions for {community}.
          </p>
          <button style={btnPrimary} onClick={() => void handleGenerate()}>
            Generate City Report
          </button>
        </div>
      </div>
    );
  }

  if (state.kind === "preparing") {
    return (
      <div>
        {header}
        <div style={cardStyle} aria-live="polite" aria-busy="true">
          <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>⏳</div>
          <p style={{ fontWeight: 700, color: C.primary, marginBottom: "0.5rem" }}>
            Preparing your city report&hellip;
          </p>
          <p style={{ color: C.muted, fontSize: "0.85rem" }}>
            This usually takes 30–60 seconds.
          </p>
          <div
            style={{
              marginTop: "1.25rem",
              height: "4px",
              borderRadius: "2px",
              backgroundColor: "#E2E8F0",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min(95, (state.attempt / MAX_POLL_ATTEMPTS) * 100)}%`,
                backgroundColor: C.primary,
                transition: "width 0.5s ease",
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div>
        {header}
        <div
          style={{ ...cardStyle, border: "1px solid #FECACA" }}
          role="alert"
        >
          <div style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>⚠️</div>
          <p style={{ fontWeight: 700, color: C.warning, marginBottom: "0.5rem" }}>
            Report preparation failed
          </p>
          <p style={{ color: C.muted, fontSize: "0.875rem", marginBottom: "1.25rem" }}>
            {state.message}
          </p>
          {state.retryable && (
            <button style={btnPrimary} onClick={() => void handleGenerate()}>
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Complete ─────────────────────────────────────────────────────────────────
  const { snapshot, version, generatedAt, needsUpdate } = state;

  const generatedDate = (() => {
    try {
      return new Date(generatedAt).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return generatedAt;
    }
  })();

  const reportUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/projects/${projectId}/research`
      : `/projects/${projectId}/research`;

  return (
    <div>
      {header}

      {needsUpdate && (
        <div
          role="alert"
          style={{
            backgroundColor: "#FFF7D6",
            border: "1px solid #EAB308",
            borderRadius: "0.65rem",
            padding: "1rem",
            marginBottom: "1rem",
            color: "#713F12",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <strong>This report needs an update.</strong>
            <div style={{ fontSize: "0.85rem", marginTop: "0.2rem" }}>
              It was created with an older data-coverage method. Update it to use the current HUD and Census evidence.
            </div>
          </div>
          <button style={btnPrimary} onClick={() => void handleGenerate()} type="button">
            Update Report Now
          </button>
        </div>
      )}

      {runError && (
        <div
          role="alert"
          style={{
            backgroundColor: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: "0.5rem",
            padding: "0.75rem 1rem",
            marginBottom: "1rem",
            fontSize: "0.875rem",
            color: "#991B1B",
          }}
        >
          {runError}
        </div>
      )}

      {/* Minimal status bar: date + update control only */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          flexWrap: "wrap",
          padding: "0.625rem 1rem",
          backgroundColor: "#F8FAFC",
          border: `1px solid ${C.border}`,
          borderRadius: "0.5rem",
          marginBottom: "1rem",
          fontSize: "0.8rem",
        }}
      >
        <span style={{ color: C.muted }}>Generated {generatedDate}</span>
        <div style={{ flex: 1 }} />
        <button
          style={btnSecondary}
          onClick={() => void handleGenerate()}
          type="button"
        >
          {needsUpdate ? "Update Required" : "↻ Update Report"}
        </button>
      </div>

      {/* Export controls */}
      <MarketReportExportBar
        projectId={projectId}
        completedVersion={version}
        generatedAt={generatedAt}
        onlineReportUrl={reportUrl}
      />

      {/* Report body */}
      <MarketReportView report={snapshot} />

      {/* Proceed to Find Properties */}
      <div
        style={{
          marginTop: "2rem",
          padding: "1.5rem",
          backgroundColor: "#F0FDF4",
          border: "1px solid #BBF7D0",
          borderRadius: "0.75rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <p
            style={{ fontWeight: 700, color: "#166534", margin: "0 0 0.25rem", fontSize: "0.95rem" }}
          >
            Ready to search for properties?
          </p>
          <p style={{ fontSize: "0.825rem", color: "#166534", margin: 0, opacity: 0.8 }}>
            {alreadyEligible
              ? "This project is already in the property search stage."
              : "Proceeding will advance this project to property discovery."}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.375rem" }}>
          <button
            style={{
              ...btnProceed,
              opacity: isProceedPending ? 0.6 : 1,
              cursor: isProceedPending ? "not-allowed" : "pointer",
            }}
            onClick={handleProceed}
            disabled={isProceedPending}
            type="button"
          >
            {isProceedPending ? "Opening…" : "Proceed to Find Properties →"}
          </button>
          {proceedError && (
            <p
              role="alert"
              style={{ fontSize: "0.8rem", color: "#991B1B", margin: 0 }}
            >
              {proceedError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
