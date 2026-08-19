import { describe, expect, it } from "vitest";

import {
  CURRENT_REPORT_ENGINE_VERSION,
  reportNeedsUpdate,
} from "../market-intelligence/report-version";

describe("market report engine version", () => {
  it("marks legacy snapshots without an engine version as outdated", () => {
    expect(reportNeedsUpdate({})).toBe(true);
  });

  it("marks older engine versions as outdated", () => {
    expect(reportNeedsUpdate({ analysisEngineVersion: CURRENT_REPORT_ENGINE_VERSION - 1 })).toBe(true);
  });

  it("accepts the current engine version", () => {
    expect(reportNeedsUpdate({ analysisEngineVersion: CURRENT_REPORT_ENGINE_VERSION })).toBe(false);
  });

  it("does not treat a missing report as an outdated saved report", () => {
    expect(reportNeedsUpdate(null)).toBe(false);
  });
});
