import { LAND_MASK_BASE64, LAND_MASK_COUNT } from "@/data/generated/land-mask";

let cache: [number, number][] | null = null;

/** Land points as [lat, lng], decoded from the generated Fibonacci mask. */
export function landPoints(): [number, number][] {
  if (cache) return cache;
  const bin = atob(LAND_MASK_BASE64);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const out: [number, number][] = [];
  for (let i = 0; i < LAND_MASK_COUNT; i++) {
    if (!((bin.charCodeAt(i >> 3) >> (i & 7)) & 1)) continue;
    const y = 1 - (i / (LAND_MASK_COUNT - 1)) * 2;
    const lat = (Math.asin(y) * 180) / Math.PI;
    const lng = (((((golden * i * 180) / Math.PI) % 360) + 540) % 360) - 180;
    out.push([lat, lng]);
  }
  cache = out;
  return out;
}

/** Great-circle distance in km. */
export function distanceKm(a: [number, number], b: [number, number]) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
