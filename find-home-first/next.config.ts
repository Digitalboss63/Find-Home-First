import type { NextConfig } from "next";
import fs from "fs";
import path from "path";

// Copy maplibre-gl worker to public/ so setWorkerUrl("/maplibre-worker.mjs")
// resolves correctly from any page. MapLibre GL v6 is ESM-only; bundlers
// (Next.js/webpack/Turbopack) cannot auto-resolve the worker from
// import.meta.url inside the bundle graph — this is the documented fix.
// Runs at build time; safe to run repeatedly (idempotent copy).
function copyMaplibreWorker() {
  try {
    const workerSrc = path.resolve(
      "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs"
    );
    const publicDir = path.resolve("public");
    const workerDst = path.join(publicDir, "maplibre-worker.mjs");
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
    fs.copyFileSync(workerSrc, workerDst);
  } catch {
    // Non-fatal: worker copy failure surfaces at runtime as blank tiles,
    // not a build crash. The missing-worker case is already handled by
    // the existing onMapError() fallback.
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
