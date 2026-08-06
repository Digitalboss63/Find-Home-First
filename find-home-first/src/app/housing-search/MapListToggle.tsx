"use client";

/**
 * MapListToggle — mobile Map/List view toggle button.
 * Keyboard accessible, announces state via aria-pressed.
 * Hidden on desktop (CSS only — no JS media query needed).
 */

import React from "react";

interface Props {
  view: "map" | "list";
  onToggle: () => void;
}

export function MapListToggle({ view, onToggle }: Props) {
  return (
    <div
      className="map-list-toggle"
      style={{
        display: "flex",
        border: "1px solid var(--color-border)",
        borderRadius: "0.5rem",
        overflow: "hidden",
        width: "fit-content",
      }}
    >
      <button
        type="button"
        aria-pressed={view === "list"}
        onClick={() => view !== "list" && onToggle()}
        style={{
          padding: "0.4rem 0.875rem",
          fontSize: "0.8rem",
          fontWeight: 600,
          border: "none",
          cursor: view === "list" ? "default" : "pointer",
          backgroundColor: view === "list" ? "var(--color-primary)" : "#fff",
          color: view === "list" ? "#fff" : "var(--color-text)",
        }}
      >
        ≡ List
      </button>
      <button
        type="button"
        aria-pressed={view === "map"}
        onClick={() => view !== "map" && onToggle()}
        style={{
          padding: "0.4rem 0.875rem",
          fontSize: "0.8rem",
          fontWeight: 600,
          border: "none",
          borderLeft: "1px solid var(--color-border)",
          cursor: view === "map" ? "default" : "pointer",
          backgroundColor: view === "map" ? "var(--color-primary)" : "#fff",
          color: view === "map" ? "#fff" : "var(--color-text)",
        }}
      >
        ⊞ Map
      </button>
    </div>
  );
}
