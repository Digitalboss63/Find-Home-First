import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildGoogleStreetViewUrl } from "../google-maps-url";

describe("Google Street View URL", () => {
  it("opens the nearest panorama using property coordinates", () => {
    const value = buildGoogleStreetViewUrl(33.749, -84.388);
    expect(value).not.toBeNull();

    const url = new URL(value!);
    expect(url.origin).toBe("https://www.google.com");
    expect(url.pathname).toBe("/maps/@");
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("map_action")).toBe("pano");
    expect(url.searchParams.get("viewpoint")).toBe("33.749,-84.388");
  });

  it("requires no key, token, or API request URL", () => {
    const value = buildGoogleStreetViewUrl(33.749, -84.388)!;
    expect(value).not.toContain("key=");
    expect(value).not.toContain("token=");
    expect(value).not.toContain("maps.googleapis.com");
  });

  it.each([
    [null, -84.388],
    [33.749, null],
    [Number.NaN, -84.388],
    [33.749, Number.POSITIVE_INFINITY],
    [91, -84.388],
    [-91, -84.388],
    [33.749, 181],
    [33.749, -181],
  ])("returns null for invalid coordinates (%s, %s)", (latitude, longitude) => {
    expect(buildGoogleStreetViewUrl(latitude, longitude)).toBeNull();
  });
});

describe("Street View UI contract", () => {
  const appDir = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../app/housing-search",
  );
  const mapSource = readFileSync(join(appDir, "PropertyMap.tsx"), "utf8");
  const clientSource = readFileSync(join(appDir, "PropertySearchClient.tsx"), "utf8");

  it("offers Street View in the selected-property map overlay and listing card", () => {
    expect(mapSource).toContain("View latest Street View");
    expect(clientSource).toContain("View latest Street View");
  });

  it("opens Street View safely in a new tab", () => {
    for (const source of [mapSource, clientSource]) {
      expect(source).toContain('target="_blank"');
      expect(source).toContain('rel="noopener noreferrer"');
    }
  });

  it("states that the imagery may not be exact or current", () => {
    for (const source of [mapSource, clientSource]) {
      expect(source).toContain("may not show the exact property or its current condition");
    }
  });
});
