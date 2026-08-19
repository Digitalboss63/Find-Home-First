import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

const cityReportSource = readFileSync(
  new URL("../../app/projects/[id]/research/CityReportPage.tsx", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"),
  "utf8",
);

const exportBarSource = readFileSync(
  new URL("../../components/MarketReportExportBar.tsx", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"),
  "utf8",
);

describe("city report network recovery", () => {
  it("retries a transient report-load failure before showing an error", () => {
    expect(cityReportSource).toContain("if (attempt < 2)");
    expect(cityReportSource).toContain("return loadReport(attempt + 1)");
  });

  it("load failures retry loading rather than creating another report", () => {
    expect(cityReportSource).toContain('retry: "load"');
    expect(cityReportSource).toContain('if (state.retry === "load")');
    expect(cityReportSource).toContain("void loadReport()");
  });

  it("a failed update restores the previously completed report", () => {
    expect(cityReportSource).toContain("const previousComplete = state.kind === \"complete\" ? state : null");
    expect(cityReportSource.match(/setState\(previousComplete\)/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("a failed update explains that the saved report remains available", () => {
    expect(cityReportSource).toContain("Your saved report is still available");
  });
});

describe("report download recovery", () => {
  it("stops a stalled download after 45 seconds", () => {
    expect(exportBarSource).toContain("new AbortController()");
    expect(exportBarSource).toContain("45_000");
    expect(exportBarSource).toContain("controller.abort()");
  });

  it("always clears the timeout and downloading state", () => {
    expect(exportBarSource).toContain("window.clearTimeout(timeout)");
    expect(exportBarSource).toContain("setDownloading(null)");
  });
});

