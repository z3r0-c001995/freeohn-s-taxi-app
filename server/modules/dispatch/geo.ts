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

// Lightweight geo-bucket key. This is not a replacement for H3/PostGIS,
// but keeps candidate scans bounded in the in-memory fallback store.
export function geoBucket(lat: number, lng: number, precision = 1): string {
  const factor = Math.pow(10, precision);
  const latBucket = Math.round(lat * factor) / factor;
  const lngBucket = Math.round(lng * factor) / factor;
  return `${latBucket}:${lngBucket}`;
}

