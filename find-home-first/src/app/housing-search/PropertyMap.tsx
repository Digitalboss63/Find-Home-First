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

  // ── Initialize map ───────────────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    let map: MaplibreMap | null = null;

    (async () => {
      try {
        // Check WebGL support before attempting to create the map
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        if (!gl) {
          if (isMounted.current) onMapError();
          return;
        }

        const maplibre = await import("maplibre-gl");
        if (!containerRef.current || !isMounted.current) return;

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

          const features = validListings.map(l => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [l.longitude!, l.latitude!] },
            properties: {
              id: l.id,
              rent: formatRent(l.price),
              isSaved: savedLeadIds.has(l.id),
              address: l.formattedAddress,
            },
          }));

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
                "case",
                ["==", ["get", "id"], selectedId ?? ""],
                "#B45309",
                "#173F5F",
              ],
              "circle-radius": 14,
              "circle-stroke-width": [
                "case",
                ["==", ["get", "id"], selectedId ?? ""],
                3,
                1,
              ],
              "circle-stroke-color": "#fff",
            },
          });

          // Rent label on unclustered markers
          map.addLayer({
            id: "unclustered-label",
            type: "symbol",
            source: "listings",
            filter: ["!", ["has", "point_count"]],
            layout: {
              "text-field": "{rent}",
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
    const features = validListings.map(l => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [l.longitude!, l.latitude!] },
      properties: {
        id: l.id,
        rent: formatRent(l.price),
        isSaved: savedLeadIds.has(l.id),
        address: l.formattedAddress,
      },
    }));

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
  }, [listings, savedLeadIds, mapReady]);

  // ── Update selected marker paint ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.getLayer("unclustered-point")) return;

    map.setPaintProperty("unclustered-point", "circle-color", [
      "case",
      ["==", ["get", "id"], selectedId ?? ""],
      "#B45309",
      "#173F5F",
    ]);
    map.setPaintProperty("unclustered-point", "circle-stroke-width", [
      "case",
      ["==", ["get", "id"], selectedId ?? ""],
      3,
      1,
    ]);

    // Center on selected listing without triggering a new search
    if (selectedId) {
      const listing = listings.find(l => l.id === selectedId);
      if (listing?.latitude && listing?.longitude) {
        map.easeTo({
          center: [listing.longitude, listing.latitude],
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

      {/* Empty state — shown when no listings have coordinates */}
      {listings.filter(l => l.latitude != null).length === 0 && (
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
