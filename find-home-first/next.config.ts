import type { NextConfig } from "next";
import fs from "fs";
import path from "path";

// Copy MapLibre GL v6 worker files to public/ at build time.
//
// maplibre-gl-worker.mjs  (~19 KB)  → public/maplibre-worker.mjs
// maplibre-gl-shared.mjs  (~479 KB) → public/maplibre-gl-shared.mjs
//
// The worker entry point is served as /maplibre-worker.mjs (registered via
// setWorkerUrl in PropertyMap.tsx). The worker contains a bare ESM import:
//   import { ... } from "./maplibre-gl-shared.mjs"
// The browser resolves that relative to the worker URL, so it fetches
// /maplibre-gl-shared.mjs — the shared module must be at that exact path.
// Both files must be present or tiles never decode and the map stays blank.
function copyMaplibreWorker() {
  try {
    const distDir = path.resolve("node_modules/maplibre-gl/dist");
    const publicDir = path.resolve("public");
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
    // Worker entry — registered via setWorkerUrl("/maplibre-worker.mjs")
    fs.copyFileSync(
      path.join(distDir, "maplibre-gl-worker.mjs"),
      path.join(publicDir, "maplibre-worker.mjs")
    );
    // Shared module — worker imports this as "./maplibre-gl-shared.mjs"
    // Must keep this exact filename so the relative import resolves correctly
    fs.copyFileSync(
      path.join(distDir, "maplibre-gl-shared.mjs"),
      path.join(publicDir, "maplibre-gl-shared.mjs")
    );
  } catch {
    // Non-fatal at build time; surfaces as blank map tiles at runtime.
    // The existing onMapError() fallback hides the map and keeps the list usable.
  }
}

copyMaplibreWorker();

const nextConfig: NextConfig = {
  // @react-pdf/renderer and exceljs are server-only packages used exclusively
  // in API route handlers (runtime="nodejs"). Marked external so they are not
  // bundled by webpack — Railway (Linux) builds cleanly with this config.
  // Local Windows H:-drive builds fail due to Turbopack junction-point
  // limitation; use next build from a local NTFS path or deploy to Railway.
  serverExternalPackages: ["@react-pdf/renderer", "exceljs"],
};

export default nextConfig;
