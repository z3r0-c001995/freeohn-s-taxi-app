// Fare calculation constants
export const FARE_CONFIG = {
  BASE_FARE: 2.50, // Base fare in USD
  PER_KM: 1.20, // Cost per kilometer
  PER_MINUTE: 0.25, // Cost per minute
  PREMIUM_MULTIPLIER: 1.5, // Multiplier for premium rides
  MINIMUM_FARE: 5.00, // Minimum fare
} as const;

export type RideType = "standard" | "premium";

export function calculateFare(
  distanceKm: number,
  durationMinutes: number,
  rideType: RideType = "standard"
): number {
  const base = FARE_CONFIG.BASE_FARE;
  const distanceCost = distanceKm * FARE_CONFIG.PER_KM;
  const timeCost = durationMinutes * FARE_CONFIG.PER_MINUTE;
  const subtotal = base + distanceCost + timeCost;
  const total = rideType === "premium" ? subtotal * FARE_CONFIG.PREMIUM_MULTIPLIER : subtotal;
  return Math.max(total, FARE_CONFIG.MINIMUM_FARE);
}