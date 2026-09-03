import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  makeAreaSearchFingerprint,
  makePropertySearchFingerprint,
  restoreSuccessfulFingerprint,
} from "@/lib/property-search-state";

const CLIENT_PATH = path.resolve(
  __dirname,
  "../../app/housing-search/PropertySearchClient.tsx"
);
const ACTIONS_PATH = path.resolve(
  __dirname,
  "../../app/housing-search/actions.ts"
);

const baseCriteria = {
  city: "Atlanta",
  state: "GA",
  zipCode: "30326",
  propertyType: "Single Family",
  minBedrooms: "4",
  minBathrooms: "2",
  maxRent: "2500",
  maxDaysListed: "",
  listingStatus: "active",
};

describe("property search fingerprints", () => {
  it("is deterministic and normalizes harmless casing/whitespace", () => {
    expect(makePropertySearchFingerprint(baseCriteria)).toBe(
      makePropertySearchFingerprint({
        ...baseCriteria,
        city: " atlanta ",
        state: "ga",
        listingStatus: "Active",
      })
    );
  });

  it("changes when a paid-search criterion changes", () => {
    expect(makePropertySearchFingerprint(baseCriteria)).not.toBe(
      makePropertySearchFingerprint({ ...baseCriteria, maxRent: "3000" })
    );
  });

  it("distinguishes a map search from a criteria search", () => {
    const area = makeAreaSearchFingerprint({
      latitude: 33.749,
      longitude: -84.388,
      radiusMiles: 10,
      ...baseCriteria,
    });
    expect(area).not.toBe(makePropertySearchFingerprint(baseCriteria));
    expect(area).toContain('"mode":"map"');
  });
});

describe("successful snapshot restoration", () => {
  it("restores a fingerprint for an empty successful snapshot", () => {
    const fingerprint = makePropertySearchFingerprint(baseCriteria);
    expect(restoreSuccessfulFingerprint({
      submitted: true,
      queryFingerprint: fingerprint,
      resultsSnapshot: "[]",
    })).toBe(fingerprint);
  });

  it("rejects missing, malformed, and non-array snapshots", () => {
    expect(restoreSuccessfulFingerprint({ submitted: true, queryFingerprint: "fp", resultsSnapshot: null })).toBeNull();
    expect(restoreSuccessfulFingerprint({ submitted: true, queryFingerprint: "fp", resultsSnapshot: "{" })).toBeNull();
    expect(restoreSuccessfulFingerprint({ submitted: true, queryFingerprint: "fp", resultsSnapshot: "{}" })).toBeNull();
  });

  it("rejects a snapshot that was never submitted", () => {
    expect(restoreSuccessfulFingerprint({
      submitted: false,
      queryFingerprint: "fp",
      resultsSnapshot: "[]",
    })).toBeNull();
  });
});

describe("source-level cost and persistence guards", () => {
  const clientSource = fs.readFileSync(CLIENT_PATH, "utf8");
  const actionSource = fs.readFileSync(ACTIONS_PATH, "utf8");

  it("filter-removal pills only clear the filter and never auto-search", () => {
    expect(clientSource).toContain("onClick={filter.clear}");
    expect(clientSource).not.toContain("onClick={() => { filter.clear(); handleSearch");
  });

  it("fresh data is requested only by explicit Refresh buttons", () => {
    expect(clientSource).toContain("Refresh Results");
    expect(clientSource.match(/onClick=\{handleRefreshResults\}/g)?.length).toBe(2);
    expect(clientSource).toContain("handleSearchThisArea(mapCenter.lat, mapCenter.lng, mapRadius, true)");
    expect(clientSource).toContain("handleSearch(true)");
  });

  it("client search errors do not erase the prior results", () => {
    const searchHandler = clientSource.slice(
      clientSource.indexOf("function handleSearch(forceRefresh"),
      clientSource.indexOf("// ── Reset")
    );
    const errorBranch = searchHandler.slice(
      searchHandler.indexOf("if (result.error)"),
      searchHandler.indexOf("} else {")
    );
    expect(errorBranch).not.toContain("setResults([])");
  });

  it("server search errors return before the successful snapshot write", () => {
    const searchAction = actionSource.slice(
      actionSource.indexOf("export async function searchPropertiesAction"),
      actionSource.indexOf("// --- Search This Area")
    );
    expect(searchAction.indexOf("if (result.error)")).toBeLessThan(
      searchAction.indexOf("await upsertPropertySearchDraft")
    );
    expect(searchAction).toContain("const snapshot = JSON.stringify(result.listings)");
  });

  it("map-area results are persisted from the trusted server response", () => {
    const areaAction = actionSource.slice(
      actionSource.indexOf("export async function searchThisAreaAction"),
      actionSource.indexOf("// --- Owner enrichment")
    );
    expect(areaAction).toContain("resultsSnapshot: JSON.stringify(result.listings)");
    expect(areaAction).toContain('mapMode: "map"');
  });
});