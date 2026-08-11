"use client";

/**
 * PropertyMap — MapLibre GL map with GeoJSON clustering.
 *
 * Tile source: OpenFreeMap Liberty (no API key, no billing).
 * https://tiles.openfreemap.org/styles/liberty
 *
 * Accessibility:
 * - role="region" aria-label="Property results map" (not application)
 * - All actions also available in the property list (map is supplemental)
 * - Custom buttons have visible labels
 * - Attribution control visible at all times
 * - No keyboard focus trap
 * - prefers-reduced-motion respected for pan/zoom
 *
 * Error handling:
 * - Fatal errors (WebGL unavailable, map construction throws, style load fails)
 *   call onMapError() → hides map, shows notice, list stays fully usable
 * - Non-fatal errors (individual tile/source fetch failures) are silently ignored
 *   and do not hide a functioning map
 *
 * No MAPBOX_TOKEN, MAPTILER_KEY, or any credential required.
 */

// MapLibre CSS must be imported at module level so Next.js bundles it.
// This file is only ever rendered on the client (loaded via next/dynamic ssr:false).
import "maplibre-gl/dist/maplibre-gl.css";

import React, { useEffect, useRef, useState, useCallback } from "react";
import type { RentCastListing } from "@/lib/rentcast";
import type { Map as MaplibreMap, GeoJSONSource } from "maplibre-gl";
import type { ListingClassification } from "@/lib/property-relevance";
import { buildGoogleStreetViewUrl } from "@/lib/google-maps-url";

const FIT_SYMBOL: Record<string, string> = {
  strong_fit: "✓",
  review_needed: "?",
  does_not_meet: "×",
};

interface Props {
  listings: RentCastListing[];
  savedLeadIds: Set<string>;
  selectedId: string | null;
  onSelectListing: (id: string | null) => void;
  onSearchThisArea: (lat: number, lng: number, radiusMi: number) => void;
  /** Called only on fatal errors — tile/source errors are non-fatal and not forwarded. */
  onMapError: () => void;
  initialCenter?: { lat: number; lng: number } | null;
  initialRadius?: number;
  classifiedById?: Record<string, ListingClassification>;
}

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const SUPPORTED_RADII = [5, 10, 25] as const;
const DEFAULT_RADIUS = 10;
const DEFAULT_CENTER = { lng: -84.388, lat: 33.749 }; // Atlanta fallback

export function formatRent(price: number | null): string {
  if (price == null) return "?";
  if (price >= 1000) return `$${(price / 1000).toFixed(1)}k`;
  return `$${price}`;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Determines whether a MapLibre error event is fatal.
 * Fatal: WebGL not supported, style failed to load after map construction.
 * Non-fatal: individual tile fetch failures, source data errors, network blips.
 */
function isFatalMapError(e: { error?: { message?: string }; sourceId?: string }): boolean {
  // Source-level errors (tile failures) are non-fatal
  if (e.sourceId) return false;
  const msg = e.error?.message ?? "";
  // WebGL failures and style load failures are fatal
  if (msg.includes("WebGL") || msg.includes("style") || msg.includes("Failed to load")) {
    return true;
  }
  // Unknown errors without a sourceId are treated as non-fatal to preserve map
  return false;
}

export function PropertyMap({
  listings,
  savedLeadIds,
  selectedId,
  onSelectListing,
  onSearchThisArea,
  onMapError,
  initialCenter,
  initialRadius = DEFAULT_RADIUS,
  classifiedById,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapMoved, setMapMoved] = useState(false);
  const [radiusMi, setRadiusMi] = useState<number>(
    SUPPORTED_RADII.includes(initialRadius as 5 | 10 | 25) ? initialRadius : DEFAULT_RADIUS
  );
  const isMounted = useRef(true);
  const styleFailed = useRef(false);
  const selectedListing = selectedId
    ? listings.find(listing => listing.id === selectedId) ?? null
    : null;
  const selectedStreetViewUrl = buildGoogleStreetViewUrl(
    selectedListing?.latitude,
    selectedListing?.longitude,
  );

  // ── Initialize map ───────────────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    let map: MaplibreMap | null = null;

    (async () => {
      try {
        // MapLibre GL v6 requires WebGL2 (v1 support was dropped in v6.0.0).
        // Test webgl2 explicitly — a WebGL1-only context passes the old check
        // but causes blank tiles because the renderer silently fails.
        const canvas = document.createElement("canvas");
        const gl2 = canvas.getContext("webgl2");
        if (!gl2) {
          if (isMounted.current) onMapError();
          return;
        }

        const maplibre = await import("maplibre-gl");
        if (!containerRef.current || !isMounted.current) return;

        // MapLibre GL v6 is ESM-only. Bundlers (Next.js/webpack/Turbopack) cannot
        // auto-resolve the worker file from import.meta.url inside the bundle graph.
        // setWorkerUrl() must be called before new Map() or tiles never decode.
        // The worker file is copied to the public directory at build time via next.config.
        maplibre.setWorkerUrl("/maplibre-worker.mjs");

        // Determine initial center from props, existing results, or fallback
        let center: [number, number] = [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat];
        const validListings = listings.filter(l => l.latitude != null && l.longitude != null);

        if (initialCenter) {
          center = [initialCenter.lng, initialCenter.lat];
        } else if (validListings.length > 0) {
          const avgLng = validListings.reduce((s, l) => s + l.longitude!, 0) / validListings.length;
          const avgLat = validListings.reduce((s, l) => s + l.latitude!, 0) / validListings.length;
          center = [avgLng, avgLat];
        }

        map = new maplibre.Map({
          container: containerRef.current,
          style: STYLE_URL,
          center,
          zoom: 11,
          attributionControl: { compact: false },
        });

        mapRef.current = map;

        // ── Error handling: distinguish fatal from non-fatal ──────────────────
        map.on("error", (e: { error?: { message?: string }; sourceId?: string }) => {
          if (!isMounted.current) return;
          // Never log credential-containing strings — just the error message
          if (isFatalMapError(e)) {
            styleFailed.current = true;
            onMapError();
          }
          // Non-fatal (tile/source errors): silently ignore — map stays functional
        });

        map.on("moveend", () => {
          if (!isMounted.current) return;
          setMapMoved(true);
        });

        map.on("load", () => {
          if (!map || !isMounted.current || styleFailed.current) return;
          setMapReady(true);

          const features = validListings.map(l => {
            const cls = classifiedById?.[l.id];
            const fitStatus = cls?.fitStatus ?? "review_needed";
            const fitSymbol = FIT_SYMBOL[fitStatus] ?? "?";
            return {
              type: "Feature" as const,
              geometry: { type: "Point" as const, coordinates: [l.longitude!, l.latitude!] },
              properties: {
                id: l.id,
                rent: formatRent(l.price),
                isSaved: savedLeadIds.has(l.id),
                address: l.formattedAddress,
                fitStatus,
                fitSymbol,
              },
            };
          });

          map.addSource("listings", {
            type: "geojson",
            data: { type: "FeatureCollection", features },
            cluster: true,
            clusterMaxZoom: 14,
            clusterRadius: 50,
          });

          // Cluster circles
          map.addLayer({
            id: "clusters",
            type: "circle",
            source: "listings",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": "#173F5F",
              "circle-radius": ["step", ["get", "point_count"], 16, 5, 22, 25, 28],
              "circle-stroke-width": 2,
              "circle-stroke-color": "#fff",
            },
          });

          // Cluster count labels
          map.addLayer({
            id: "cluster-count",
            type: "symbol",
            source: "listings",
            filter: ["has", "point_count"],
            layout: {
              "text-field": "{point_count_abbreviated}",
              "text-size": 12,
              "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
            },
            paint: { "text-color": "#ffffff" },
          });

          // Unclustered marker circles
          map.addLayer({
            id: "unclustered-point",
            type: "circle",
            source: "listings",
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": [
                "match",
                ["get", "fitStatus"],
                "strong_fit", "#173F5F",
                "review_needed", "#B45309",
                "does_not_meet", "#6B7280",
                "#B45309",
              ],
              "circle-radius": 14,
              "circle-stroke-width": [
                "case",
                ["==", ["get", "id"], selectedId ?? ""],
                3,
                1,
              ],
              "circle-stroke-color": [
                "case",
                ["==", ["get", "id"], selectedId ?? ""],
                "#111827",
                "#fff",
              ],
            },
          });

          // Rent label on unclustered markers (fitSymbol + rent)
          map.addLayer({
            id: "unclustered-label",
            type: "symbol",
            source: "listings",
            filter: ["!", ["has", "point_count"]],
            layout: {
              "text-field": "{fitSymbol} {rent}",
              "text-size": 10,
              "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
              "text-anchor": "center",
            },
            paint: { "text-color": "#ffffff" },
          });

          // Saved indicator (★ text above saved markers — not color alone)
          map.addLayer({
            id: "saved-indicator",
            type: "symbol",
            source: "listings",
            filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "isSaved"], true]],
            layout: {
              "text-field": "★",
              "text-size": 12,
              "text-anchor": "bottom",
              "text-offset": [0, -1.8],
            },
            paint: { "text-color": "#F2C14E" },
          });

          // Click cluster → zoom in
          map.on("click", "clusters", (e) => {
            const feats = map!.queryRenderedFeatures(e.point, { layers: ["clusters"] });
            if (!feats.length) return;
            const clusterId = feats[0].properties.cluster_id as number;
            const source = map!.getSource("listings") as GeoJSONSource;
            source.getClusterExpansionZoom(clusterId).then((zoom: number) => {
              const geom = feats[0].geometry as GeoJSON.Point;
              map!.easeTo({
                center: geom.coordinates as [number, number],
                zoom,
                animate: !prefersReducedMotion(),
              });
            });
          });

          // Click individual marker → select/deselect
          map.on("click", "unclustered-point", (e) => {
            const feature = e.features?.[0];
            if (!feature) return;
            const id = feature.properties?.id as string;
            onSelectListing(id === selectedId ? null : id);
          });

          // Close selection on background click
          map.on("click", (e) => {
            const feats = map!.queryRenderedFeatures(e.point, {
              layers: ["unclustered-point", "clusters"],
            });
            if (!feats.length) onSelectListing(null);
          });

          // Pointer cursors for interactive layers
          map.on("mouseenter", "clusters", () => { map!.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", "clusters", () => { map!.getCanvas().style.cursor = ""; });
          map.on("mouseenter", "unclustered-point", () => { map!.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", "unclustered-point", () => { map!.getCanvas().style.cursor = ""; });

          // Fit bounds to existing results
          if (validListings.length > 0) {
            const lngs = validListings.map(l => l.longitude!);
            const lats = validListings.map(l => l.latitude!);
            const bounds: [[number, number], [number, number]] = [
              [Math.min(...lngs), Math.min(...lats)],
              [Math.max(...lngs), Math.max(...lats)],
            ];
            map.fitBounds(bounds, {
              padding: 60,
              maxZoom: 14,
              animate: !prefersReducedMotion(),
            });
          }
        });

      } catch {
        // Map construction threw — fatal
        if (isMounted.current) onMapError();
      }
    })();

    return () => {
      isMounted.current = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally only on mount

  // ── Update GeoJSON source when listings/savedLeadIds change ─────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const source = map.getSource("listings") as GeoJSONSource | undefined;
    if (!source) return;

    const validListings = listings.filter(l => l.latitude != null && l.longitude != null);
    const features = validListings.map(l => {
      const cls = classifiedById?.[l.id];
      const fitStatus = cls?.fitStatus ?? "review_needed";
      const fitSymbol = FIT_SYMBOL[fitStatus] ?? "?";
      return {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [l.longitude!, l.latitude!] },
        properties: {
          id: l.id,
          rent: formatRent(l.price),
          isSaved: savedLeadIds.has(l.id),
          address: l.formattedAddress,
          fitStatus,
          fitSymbol,
        },
      };
    });

    source.setData({ type: "FeatureCollection", features });

    // Re-fit bounds when new results arrive
    if (validListings.length > 0) {
      const lngs = validListings.map(l => l.longitude!);
      const lats = validListings.map(l => l.latitude!);
      const bounds: [[number, number], [number, number]] = [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ];
      map.fitBounds(bounds, {
        padding: 60,
        maxZoom: 14,
        animate: !prefersReducedMotion(),
      });
    }

    setMapMoved(false);
  }, [listings, savedLeadIds, mapReady, classifiedById]);

  // ── Update selected marker paint ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.getLayer("unclustered-point")) return;

    map.setPaintProperty("unclustered-point", "circle-color", [
      "match",
      ["get", "fitStatus"],
      "strong_fit", "#173F5F",
      "review_needed", "#B45309",
      "does_not_meet", "#6B7280",
      "#B45309",
    ]);
    map.setPaintProperty("unclustered-point", "circle-stroke-width", [
      "case",
      ["==", ["get", "id"], selectedId ?? ""],
      3,
      1,
    ]);
    map.setPaintProperty("unclustered-point", "circle-stroke-color", [
      "case",
      ["==", ["get", "id"], selectedId ?? ""],
      "#111827",
      "#fff",
    ]);

    // Center and zoom on selected listing so the marker is visible.
    // clusterMaxZoom is 14 — zoom to 15 to guarantee the cluster breaks apart
    // and the individual amber marker is actually rendered and selectable.
    if (selectedId) {
      const listing = listings.find(l => l.id === selectedId);
      if (listing?.latitude && listing?.longitude) {
        const currentZoom = map.getZoom();
        map.easeTo({
          center: [listing.longitude, listing.latitude],
          // Only zoom in if we're currently clustered (below 15).
          // Never zoom out — if the user is already zoomed in past 15, keep their zoom.
          zoom: currentZoom < 15 ? 15 : currentZoom,
          animate: !prefersReducedMotion(),
        });
      }
    }
  }, [selectedId, listings, mapReady]);

  const handleSearchThisArea = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const center = map.getCenter();
    setMapMoved(false);
    onSearchThisArea(center.lat, center.lng, radiusMi);
  }, [radiusMi, onSearchThisArea]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Map container — region role, not application (list is the accessible primary) */}
      <div
        ref={containerRef}
        role="region"
        aria-label="Property results map"
        style={{ width: "100%", height: "100%" }}
      />

      {/* Map controls overlay */}
      <div
        style={{
          position: "absolute",
          top: "0.75rem",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          zIndex: 10,
        }}
      >
        {/* Search This Area — only visible after user pans/zooms; never auto-fires */}
        {mapMoved && (
          <button
            type="button"
            aria-label="Search for properties in this map area"
            onClick={handleSearchThisArea}
            style={{
              backgroundColor: "#fff",
              border: "1px solid var(--color-border)",
              borderRadius: "1rem",
              padding: "0.4rem 1rem",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
              color: "var(--color-primary)",
              whiteSpace: "nowrap",
            }}
          >
            Search This Area
          </button>
        )}

        {/* Radius selector */}
        <div
          role="group"
          aria-label="Search radius"
          style={{
            backgroundColor: "#fff",
            border: "1px solid var(--color-border)",
            borderRadius: "1rem",
            padding: "0 0.25rem",
            display: "flex",
            boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
          }}
        >
          {SUPPORTED_RADII.map(r => (
            <button
              key={r}
              type="button"
              aria-pressed={radiusMi === r}
              aria-label={`${r} mile search radius`}
              onClick={() => setRadiusMi(r)}
              style={{
                padding: "0.3rem 0.6rem",
                fontSize: "0.75rem",
                fontWeight: radiusMi === r ? 700 : 400,
                border: "none",
                cursor: "pointer",
                backgroundColor: radiusMi === r ? "var(--color-primary)" : "transparent",
                color: radiusMi === r ? "#fff" : "var(--color-text)",
                borderRadius: "1rem",
              }}
            >
              {r}mi
            </button>
          ))}
        </div>
      </div>

      {/* Selected-property action. Google content opens externally so it is not
          mixed into the OpenFreeMap/MapLibre map and creates no API request. */}
      {selectedListing && selectedStreetViewUrl && (
        <div
          style={{
            position: "absolute",
            right: "0.5rem",
            bottom: "2.5rem",
            zIndex: 10,
            maxWidth: "17rem",
            backgroundColor: "rgba(255,255,255,0.96)",
            border: "1px solid var(--color-border)",
            borderRadius: "0.75rem",
            padding: "0.65rem 0.75rem",
            boxShadow: "0 2px 8px rgba(0,0,0,0.14)",
          }}
          role="status"
          aria-label="Selected property Street View action"
        >
          <p
            style={{
              margin: "0 0 0.4rem",
              color: "var(--color-primary)",
              fontSize: "0.75rem",
              fontWeight: 700,
              lineHeight: 1.35,
            }}
          >
            {selectedListing.formattedAddress || selectedListing.addressLine1}
          </p>
          <a
            href={selectedStreetViewUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View latest available Google Street View for ${selectedListing.formattedAddress || selectedListing.addressLine1}`}
            style={{
              display: "inline-block",
              border: "1px solid var(--color-border)",
              borderRadius: "0.5rem",
              padding: "0.4rem 0.65rem",
              color: "var(--color-secondary)",
              backgroundColor: "#fff",
              fontSize: "0.75rem",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            View latest Street View ↗
          </a>
          <p style={{ margin: "0.4rem 0 0", fontSize: "0.65rem", lineHeight: 1.35, color: "#5E5E5E" }}>
            Latest available Google Street View; it may not show the exact property or its current condition.
          </p>
        </div>
      )}

      {/* Legend overlay */}
      <div
        style={{
          position: "absolute",
          bottom: "2.5rem",
          left: "0.5rem",
          backgroundColor: "rgba(255,255,255,0.92)",
          border: "1px solid var(--color-border)",
          borderRadius: "0.5rem",
          padding: "0.35rem 0.6rem",
          fontSize: "0.7rem",
          color: "var(--color-text)",
          zIndex: 10,
          pointerEvents: "none",
          lineHeight: 1.6,
        }}
        aria-hidden="true"
      >
        ✓ Strong Fit &nbsp; ? Review Needed &nbsp; × Does Not Meet &nbsp; ★ Saved
      </div>

      {/* Empty state — shown when no listings have coordinates */}
      {listings.filter(l => l.latitude != null && l.longitude != null).length === 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              backgroundColor: "rgba(255,255,255,0.92)",
              border: "1px solid var(--color-border)",
              borderRadius: "0.75rem",
              padding: "1rem 1.5rem",
              textAlign: "center",
              maxWidth: "20rem",
            }}
          >
            <p style={{ fontSize: "0.875rem", color: "var(--color-text)", margin: 0 }}>
              Run a property search to view results on the map.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
