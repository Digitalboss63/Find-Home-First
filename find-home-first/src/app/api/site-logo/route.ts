/**
 * GET /api/site-logo
 *
 * Serves the platform's current site logo as raw image bytes.
 *
 * - If no custom logo is saved, redirects to the default /images/fhf-logo.svg.
 * - If a custom logo is saved, returns it with the correct Content-Type and
 *   Cache-Control: no-cache so browsers always re-validate after a replacement.
 * - Public endpoint — no auth required (it's just a logo).
 * - Allowed content types mirror the upload allowlist.
 */
import { getPlatformSetting } from "@/lib/repository";

const ALLOWED_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
]);

const DEFAULT_LOGO = "/images/fhf-logo.svg";

/** Parse a data URI into its content-type and raw bytes. Returns null on failure. */
export function parseDataUri(
  dataUri: string
): { contentType: string; buffer: Buffer } | null {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUri);
  if (!match) return null;
  try {
    return { contentType: match[1], buffer: Buffer.from(match[2], "base64") };
  } catch {
    return null;
  }
}

export async function GET() {
  const setting = await getPlatformSetting("site_logo").catch(() => null);

  // No custom logo configured → redirect to default static asset.
  if (!setting?.enabled || !setting.value) {
    return new Response(null, {
      status: 302,
      headers: { Location: DEFAULT_LOGO },
    });
  }

  const parsed = parseDataUri(setting.value);

  // Malformed or disallowed type → fall back to default.
  if (!parsed || !ALLOWED_CONTENT_TYPES.has(parsed.contentType)) {
    return new Response(null, {
      status: 302,
      headers: { Location: DEFAULT_LOGO },
    });
  }

  return new Response(parsed.buffer, {
    status: 200,
    headers: {
      "Content-Type": parsed.contentType,
      // no-cache: browser must revalidate with server before using cached copy.
      // This ensures a replacement logo is picked up immediately.
      "Cache-Control": "no-cache, must-revalidate",
      "Content-Length": String(parsed.buffer.byteLength),
    },
  });
}
