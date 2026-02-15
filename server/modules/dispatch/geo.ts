export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return r * c;
}

export type GeoBounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

export const DEFAULT_GEO_CELL_SIZE_DEGREES = 0.02;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Lightweight geo-cell key. This is not a replacement for H3/PostGIS,
// but it keeps in-memory candidate scans bounded.
export function geoCell(lat: number, lng: number, cellSizeDegrees = DEFAULT_GEO_CELL_SIZE_DEGREES): string {
  const safeLat = clamp(lat, -90, 90);
  const safeLng = clamp(lng, -180, 180);
  const latCell = Math.floor((safeLat + 90) / cellSizeDegrees);
  const lngCell = Math.floor((safeLng + 180) / cellSizeDegrees);
  return `${latCell}:${lngCell}`;
}

export function boundsForRadius(lat: number, lng: number, radiusKm: number): GeoBounds {
  const safeRadius = Math.max(radiusKm, 0);
  const latDelta = safeRadius / 110.574;
  const lngDenominator = Math.max(0.0001, 111.32 * Math.cos((lat * Math.PI) / 180));
  const lngDelta = safeRadius / lngDenominator;

  return {
    minLat: clamp(lat - latDelta, -90, 90),
    maxLat: clamp(lat + latDelta, -90, 90),
    minLng: clamp(lng - lngDelta, -180, 180),
    maxLng: clamp(lng + lngDelta, -180, 180),
  };
}

export function geoCellsForBounds(bounds: GeoBounds, cellSizeDegrees = DEFAULT_GEO_CELL_SIZE_DEGREES): string[] {
  const minLatCell = Math.floor((bounds.minLat + 90) / cellSizeDegrees);
  const maxLatCell = Math.floor((bounds.maxLat + 90) / cellSizeDegrees);
  const minLngCell = Math.floor((bounds.minLng + 180) / cellSizeDegrees);
  const maxLngCell = Math.floor((bounds.maxLng + 180) / cellSizeDegrees);

  const cells: string[] = [];
  for (let latCell = minLatCell; latCell <= maxLatCell; latCell += 1) {
    for (let lngCell = minLngCell; lngCell <= maxLngCell; lngCell += 1) {
      cells.push(`${latCell}:${lngCell}`);
    }
  }
  return cells;
}

export function isWithinBounds(lat: number, lng: number, bounds: GeoBounds): boolean {
  return lat >= bounds.minLat && lat <= bounds.maxLat && lng >= bounds.minLng && lng <= bounds.maxLng;
}
