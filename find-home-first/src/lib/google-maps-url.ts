/**
 * Builds a cost-free Google Maps URL that opens the nearest available
 * interactive Street View panorama for a property coordinate.
 *
 * This does not call a Google API, require an API key, or load Google content
 * inside the application. Google Maps resolves the nearest available panorama
 * after the user explicitly follows the link.
 */
export function buildGoogleStreetViewUrl(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): string | null {
  if (
    latitude == null
    || longitude == null
    || !Number.isFinite(latitude)
    || !Number.isFinite(longitude)
    || latitude < -90
    || latitude > 90
    || longitude < -180
    || longitude > 180
  ) {
    return null;
  }

  const params = new URLSearchParams({
    api: "1",
    map_action: "pano",
    viewpoint: `${latitude},${longitude}`,
    utm_source: "find_home_first",
    utm_campaign: "property_street_view",
  });

  return `https://www.google.com/maps/@?${params.toString()}`;
}
