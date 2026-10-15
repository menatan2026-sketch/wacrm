export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres (haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface GeofenceResult {
  /** null when we can't tell (no position or no fence configured). */
  inside: boolean | null;
  distance: number | null;
}

/**
 * Inside when the reported position, widened by its own accuracy (capped at
 * 100 m so a wildly inaccurate fix can't pass anywhere), is within the radius.
 */
export function checkGeofence(
  position: (LatLng & { accuracy?: number | null }) | null,
  site: (LatLng & { radius: number }) | null,
): GeofenceResult {
  if (!position || !site) return { inside: null, distance: null };
  const distance = Math.round(distanceMeters(position, site));
  const slack = Math.min(Math.max(position.accuracy ?? 0, 0), 100);
  return { inside: distance - slack <= site.radius, distance };
}
