import type { MarketReportSnapshot } from "@/lib/export/types";

/** Increment when report interpretation or source coverage materially changes. */
export const CURRENT_REPORT_ENGINE_VERSION = 2;

export function reportNeedsUpdate(
  report: Pick<MarketReportSnapshot, "analysisEngineVersion"> | null | undefined,
): boolean {
  if (!report) return false;
  return (report.analysisEngineVersion ?? 0) < CURRENT_REPORT_ENGINE_VERSION;
}

