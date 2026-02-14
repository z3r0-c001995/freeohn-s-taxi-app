import { LocationCoord } from "./store";

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Calculate estimated fare based on distance and ride type
 */
export function calculateFare(
  distanceKm: number,
  rideType: "standard" | "premium"
): number {
  const baseFare = 2.5;
  const perKmRate = rideType === "standard" ? 1.5 : 2.5;
  const minimumFare = 5.0;

  const fare = baseFare + distanceKm * perKmRate;
  return Math.max(fare, minimumFare);
}

/**
 * Calculate estimated time based on distance (assuming average speed of 40 km/h)
 */
export function calculateEstimatedTime(distanceKm: number): number {
  const averageSpeed = 40; // km/h
  return Math.ceil((distanceKm / averageSpeed) * 60); // minutes
}

/**
 * Find nearby drivers within a certain radius
 */
export function findNearbyDrivers(
  riderLocation: LocationCoord,
  drivers: any[],
  radiusKm: number = 5
): any[] {
  return drivers.filter((driver) => {
    if (!driver.current_latitude || !driver.current_longitude) return false;

    const distance = calculateDistance(
      riderLocation.latitude,
      riderLocation.longitude,
      driver.current_latitude,
      driver.current_longitude
    );

    return distance <= radiusKm;
  });
}

/**
 * Sort drivers by distance from rider
 */
export function sortDriversByDistance(
  riderLocation: LocationCoord,
  drivers: any[]
): any[] {
  return drivers.sort((a, b) => {
    const distA = calculateDistance(
      riderLocation.latitude,
      riderLocation.longitude,
      a.current_latitude,
      a.current_longitude
    );
    const distB = calculateDistance(
      riderLocation.latitude,
      riderLocation.longitude,
      b.current_latitude,
      b.current_longitude
    );
    return distA - distB;
  });
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Format time duration
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

/**
 * Format distance
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

/**
 * Get address from coordinates (mock implementation)
 * In a real app, you would use a geocoding service
 */
export async function getAddressFromCoordinates(
  latitude: number,
  longitude: number
): Promise<string> {
  // Mock implementation - returns a formatted address
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

/**
 * Validate phone number
 */
export function validatePhoneNumber(phone: string): boolean {
  const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/;
  return phoneRegex.test(phone.replace(/\s/g, ""));
}

/**
 * Generate OTP (mock)
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Verify OTP (mock - in real app, compare with sent OTP)
 */
export function verifyOTP(enteredOTP: string, sentOTP: string): boolean {
  return enteredOTP === sentOTP;
}
