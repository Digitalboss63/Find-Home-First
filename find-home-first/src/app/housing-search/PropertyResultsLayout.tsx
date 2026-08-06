"use client";

/**
 * PropertyResultsLayout — responsive split view.
 *
 * Desktop (≥768px): ~45% sticky map / ~55% scrollable list, side by side.
 * Mobile (<768px): List by default. Map/List toggle switches between views.
 *
 * Mobile show/hide is JS-driven (controlled by mobileView state) so the
 * toggle can actually reveal the map panel. CSS media queries handle
 * hiding the toggle on desktop only.
 *
 * The list is always present in the DOM (never unmounted) for accessibility.
 * The map is lazily loaded via next/dynamic(ssr:false).
 *
 * Fatal map failures: list, search, lead save, owner details, and pipeline
 * all remain fully operational.
 */

import React, { useCallback, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import type { RentCastListing } from "@/lib/rentcast";
import { MapListToggle } from "./MapListToggle";

// ── useSyncExternalStore for isMobile — avoids SSR/client hydration mismatch ──
function subscribeMobile(cb: () => void) {
  const mq = window.matchMedia("(max-width: 767px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function getSnapshotMobile() {
  return window.matchMedia("(max-width: 767px)").matches;
}
function getServerSnapshotMobile() {
  return false;
}

// Load PropertyMap only on the client (contains maplibre-gl + CSS import)
const PropertyMap = dynamic(
  () => import("./PropertyMap").then(m => ({ default: m.PropertyMap })),
  { ssr: false, loading: () => null }
);

interface Props {
  listings: RentCastListing[];
  savedLeadIds: Set<string>;
  selectedId: string | null;
  onSelectListing: (id: string | null) => void;
  onSearchThisArea: (lat: number, lng: number, radiusMi: number) => void;
  initialCenter?: { lat: number; lng: number } | null;
  initialRadius?: number;
  listContent: React.ReactNode;
  isSearching: boolean;
}

export function PropertyResultsLayout({
  listings,
  savedLeadIds,
  selectedId,
  onSelectListing,
  onSearchThisArea,
  initialCenter,
  initialRadius,
  listContent,
  isSearching,
}: Props) {
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const [mapFailed, setMapFailed] = useState(false);
  // Track whether we are on a mobile viewport — useSyncExternalStore avoids SSR/client mismatch.
  const isMobile = useSyncExternalStore(subscribeMobile, getSnapshotMobile, getServerSnapshotMobile);

  const handleMapError = useCallback(() => {
    setMapFailed(true);
  }, []);

  // ── Visibility logic ─────────────────────────────────────────────────────────
  // Desktop: both panels always visible side-by-side (CSS controls width).
  // Mobile: only the selected view is visible.

  const showMap = !mapFailed && (!isMobile || mobileView === "map");
  const showList = !isMobile || mobileView === "list";

  // Map panel height: 600px on desktop, fills content area on mobile
  const MAP_HEIGHT = isMobile ? "calc(100vh - 12rem)" : "600px";

  return (
    <div>
      {/* Mobile-only Map/List toggle — hidden on desktop via CSS */}
      <div className="map-list-toggle-wrapper" style={{ marginBottom: "0.75rem" }}>
        <MapListToggle
          view={mobileView}
          onToggle={() => setMobileView(v => (v === "list" ? "map" : "list"))}
        />
      </div>

      {/* Map failure notice */}
      {mapFailed && (
        <div
          role="status"
          style={{
            backgroundColor: "#FFFBEB",
            border: "1px solid #FDE68A",
            borderRadius: "0.5rem",
            padding: "0.5rem 0.875rem",
            fontSize: "0.8rem",
            color: "#92400E",
            marginBottom: "0.5rem",
          }}
        >
          Map unavailable — property list and search continue to work normally.
        </div>
      )}

      {/* Split layout */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          alignItems: "flex-start",
        }}
      >
        {/* Map panel */}
        {!mapFailed && (
          <div
            data-testid="map-panel"
            data-map-visible={showMap ? "true" : "false"}
            style={{
              // Desktop: fixed 45% width. Mobile: full width when map is shown.
              flex: isMobile ? "1 1 100%" : "0 0 45%",
              height: MAP_HEIGHT,
              position: isMobile ? "relative" : "sticky",
              top: isMobile ? undefined : "1rem",
              borderRadius: "0.75rem",
              overflow: "hidden",
              border: "1px solid var(--color-border)",
              // JS-controlled visibility — works for both desktop and mobile
              display: showMap ? "block" : "none",
            }}
          >
            {!isSearching && (
              <PropertyMap
                listings={listings}
                savedLeadIds={savedLeadIds}
                selectedId={selectedId}
                onSelectListing={onSelectListing}
                onSearchThisArea={onSearchThisArea}
                onMapError={handleMapError}
                initialCenter={initialCenter}
                initialRadius={initialRadius}
              />
            )}
          </div>
        )}

        {/* List panel — always in DOM; visibility controlled by display */}
        <div
          data-testid="list-panel"
          data-list-visible={showList ? "true" : "false"}
          style={{
            flex: isMobile ? "1 1 100%" : "1 1 55%",
            minWidth: 0,
            display: showList ? "block" : "none",
          }}
        >
          {listContent}
        </div>
      </div>
    </div>
  );
}
