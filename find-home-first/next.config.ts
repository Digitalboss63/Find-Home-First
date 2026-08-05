import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer and exceljs are server-only packages used exclusively
  // in API route handlers (runtime="nodejs"). Marked external so they are not
  // bundled by webpack — Railway (Linux) builds cleanly with this config.
  // Local Windows H:-drive builds fail due to Turbopack junction-point
  // limitation; use next build from a local NTFS path or deploy to Railway.
  serverExternalPackages: ["@react-pdf/renderer", "exceljs"],
};

export default nextConfig;
