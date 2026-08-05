/**
 * Filename generator for Market Intelligence Report exports.
 *
 * Convention:
 *   Find-Home-First_{Market}_{Target-Population}_Market-Research_v{Version}_{Date}.{ext}
 *
 * Example:
 *   Find-Home-First_Atlanta-GA_Veterans_Market-Research_v1_2026-08-03.pdf
 *
 * All characters outside [A-Za-z0-9._-] are replaced with "-".
 * Multiple consecutive "-" are collapsed to one.
 */

import type { FilenameParams } from "./types";

/** Sanitize a segment: keep alphanumeric, dot, underscore, hyphen. */
function sanitizeSegment(raw: string): string {
  return raw
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildExportFilename(params: FilenameParams): string {
  const market = sanitizeSegment(`${params.city}-${params.stateAbbr}`);
  const population = sanitizeSegment(params.targetPopulation);
  const date = sanitizeSegment(params.generatedAt.slice(0, 10)); // YYYY-MM-DD
  const version = `v${params.version}`;
  const ext = params.format;

  const base = `Find-Home-First_${market}_${population}_Market-Research_${version}_${date}.${ext}`;
  return base;
}

/**
 * Produce a safe Content-Disposition header value.
 *
 * Uses `attachment` (force download) and both filename (ASCII fallback)
 * and filename* (RFC 5987 UTF-8 encoded) for maximum compatibility.
 */
export function buildContentDisposition(filename: string): string {
  // filename is already sanitized to ASCII-safe characters
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_");
  const encoded = encodeURIComponent(ascii);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
