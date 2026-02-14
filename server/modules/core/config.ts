import type { RideHailingConfig } from "../../../shared/ride-hailing";

const numberFromEnv = (key: string, fallback: number): number => {
  const value = process.env[key];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const boolFromEnv = (key: string, fallback: boolean): boolean => {
  const value = process.env[key];
  if (!value) return fallback;
  return value === "1" || value.toLowerCase() === "true";
};

export const rideConfig: RideHailingConfig = {
  dispatchRadiusKm: numberFromEnv("DISPATCH_RADIUS_KM", 10),
  offerTimeoutMs: numberFromEnv("DISPATCH_OFFER_TIMEOUT_MS", 15_000),
  maxDriverCandidates: numberFromEnv("DISPATCH_MAX_CANDIDATES", 10),
  enableTripStartPin: boolFromEnv("FEATURE_TRIP_START_PIN", true),
  tripStartPinTtlMs: numberFromEnv("TRIP_START_PIN_TTL_MS", 5 * 60_000),
  tripStartPinMaxAttempts: numberFromEnv("TRIP_START_PIN_MAX_ATTEMPTS", 5),
  tripShareTokenTtlMs: numberFromEnv("TRIP_SHARE_TOKEN_TTL_MS", 6 * 60 * 60_000),
  cancelFeeBeforeAssign: numberFromEnv("TRIP_CANCEL_FEE_BEFORE_ASSIGN", 0),
  cancelFeeAfterAssign: numberFromEnv("TRIP_CANCEL_FEE_AFTER_ASSIGN", 2.5),
  ratingRollingWindow: numberFromEnv("RATING_ROLLING_WINDOW", 100),
};

export const supportConfig = {
  email: process.env.SUPPORT_EMAIL || "support@freeohns.app",
  phone: process.env.SUPPORT_PHONE || "+1-800-000-0000",
  emergencyPhone: process.env.EMERGENCY_PHONE || "+911",
};

