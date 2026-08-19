"use client";

/**
 * MarketReportExportBar
 *
 * Displays three export controls above a completed market report:
 *   - Print Report (window.print)
 *   - Download PDF → GET /api/export/market-research/pdf?projectId=...&version=...
 *   - Download Excel → GET /api/export/market-research/xlsx?projectId=...&version=...
 *
 * Hidden when no completed report exists (caller controls rendering).
 * When a refresh is running, allows exporting the previous completed version
 * and labels that version clearly.
 *
 * Accessibility note: PDF is not tagged PDF/UA. A short note is shown
 * beside "Download PDF" directing users to the accessible online version.
 */

import React, { useState } from "react";

interface Props {
  projectId: string;
  /** The version number of the completed report to export */
  completedVersion: number;
  /** ISO date string of when the completed report was generated */
  generatedAt: string;
  /**
   * If true, a newer version is currently being generated.
   * The bar still shows, labels the version as "Previous completed version v{n}",
   * and shows a "Refresh in progress" badge.
   */
  refreshInProgress?: boolean;
  /** URL of the online report (shown in the PDF accessibility note) */
  onlineReportUrl?: string;
}

const barStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  flexWrap: "wrap",
  padding: "0.75rem 1rem",
  backgroundColor: "#F0F9FF",
  border: "1px solid #BAE6FD",
  borderRadius: "0.5rem",
  marginBottom: "1.25rem",
};

const btnBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.375rem",
  border: "1px solid #CBD5E1",
  borderRadius: "0.375rem",
  padding: "0.4rem 0.875rem",
  fontSize: "0.8rem",
  fontWeight: 600,
  cursor: "pointer",
  textDecoration: "none",
};

const btnSecondary: React.CSSProperties = { ...btnBase, backgroundColor: "#fff", color: "#1E3A5F" };
const btnPrimary: React.CSSProperties = { ...btnBase, backgroundColor: "#1E3A5F", color: "#fff", border: "1px solid #1E3A5F" };

export function MarketReportExportBar({
  projectId,
  completedVersion,
  generatedAt,
  refreshInProgress = false,
  onlineReportUrl,
}: Props) {
  const [downloading, setDownloading] = useState<"pdf" | "xlsx" | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const versionLabel = refreshInProgress
    ? `Previous completed version v${completedVersion}`
    : `v${completedVersion}`;

  const generatedDate = (() => {
    try {
      return new Date(generatedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return generatedAt;
    }
  })();

  async function handleDownload(format: "pdf" | "xlsx") {
    setDownloading(format);
    setDownloadError(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45_000);
    try {
      const url = `/api/export/market-research/${format}?projectId=${encodeURIComponent(projectId)}&version=${completedVersion}`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setDownloadError(body.error ?? `Export failed (${res.status}). Please try again.`);
        return;
      }
      const blob = await res.blob();
      const anchor = document.createElement("a");
      anchor.href = URL.createObjectURL(blob);
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      anchor.download =
        match?.[1] ??
        `market-report-v${completedVersion}.${format}`;
      anchor.click();
      URL.revokeObjectURL(anchor.href);
    } catch (error) {
      setDownloadError(
        error instanceof DOMException && error.name === "AbortError"
          ? "The download took too long and was stopped. Please try again."
          : "The download could not be completed. Please try again.",
      );
    } finally {
      window.clearTimeout(timeout);
      setDownloading(null);
    }
  }

  return (
    <div style={barStyle} role="toolbar" aria-label="Report export controls">
      {/* Version label */}
      <div style={{ flex: 1, minWidth: "200px" }}>
        <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#1E3A5F" }}>
          Export report — {versionLabel}
        </span>
        <span style={{ fontSize: "0.75rem", color: "#64748B", marginLeft: "0.5rem" }}>
          Generated {generatedDate}
        </span>
        {refreshInProgress && (
          <span
            style={{
              display: "inline-block",
              marginLeft: "0.625rem",
              fontSize: "0.7rem",
              fontWeight: 600,
              color: "#92400E",
              backgroundColor: "#FEF3C7",
              padding: "0.1rem 0.4rem",
              borderRadius: "9999px",
            }}
          >
            Refresh in progress
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-start" }}>
        {/* Print */}
        <button
          style={btnSecondary}
          onClick={() => window.print()}
          type="button"
          aria-label="Print report"
        >
          🖨 Print Report
        </button>

        {/* PDF with accessibility note */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
          <button
            style={{ ...btnPrimary, opacity: downloading === "pdf" ? 0.6 : 1 }}
            onClick={() => { void handleDownload("pdf"); }}
            disabled={downloading === "pdf"}
            type="button"
            aria-label={`Download PDF — ${versionLabel}`}
          >
            {downloading === "pdf" ? "Downloading…" : "⬇ Download PDF"}
          </button>
          <span style={{ fontSize: "0.65rem", color: "#64748B", maxWidth: "220px", lineHeight: 1.3 }}>
            PDF is formatted for printing. For the accessible version, use{" "}
            {onlineReportUrl ? (
              <a href={onlineReportUrl} style={{ color: "#1D4ED8", fontSize: "0.65rem" }}>
                this online report
              </a>
            ) : (
              "this online report"
            )}
            .
          </span>
        </div>

        {/* Excel */}
        <button
          style={{ ...btnSecondary, opacity: downloading === "xlsx" ? 0.6 : 1 }}
          onClick={() => { void handleDownload("xlsx"); }}
          disabled={downloading === "xlsx"}
          type="button"
          aria-label={`Download Excel — ${versionLabel}`}
        >
          {downloading === "xlsx" ? "Downloading…" : "⬇ Download Excel"}
        </button>
      </div>
      {downloadError && (
        <div
          role="alert"
          style={{ width: "100%", color: "#991B1B", fontSize: "0.8rem", fontWeight: 600 }}
        >
          {downloadError}
        </div>
      )}
    </div>
  );
}
