import type { FareEstimateRequest, FareSnapshot } from "../../../shared/ride-hailing";
import { FARE_CONFIG } from "../../../shared/constants/fare";

const PREMIUM_MULTIPLIER = FARE_CONFIG.PREMIUM_MULTIPLIER;

export class PricingService {
  estimateFare(input: FareEstimateRequest): FareSnapshot {
    const distanceKm = input.distanceMeters / 1000;
    const durationMinutes = input.durationSeconds / 60;
    const surgeMultiplier = this.resolveSurgeMultiplier();

    const baseFare = FARE_CONFIG.BASE_FARE;
    const distanceFare = distanceKm * FARE_CONFIG.PER_KM;
    const timeFare = durationMinutes * FARE_CONFIG.PER_MINUTE;
    const rideTypeMultiplier = input.rideType === "premium" ? PREMIUM_MULTIPLIER : 1;
    const subtotal = (baseFare + distanceFare + timeFare) * rideTypeMultiplier;
    const total = Math.max(subtotal * surgeMultiplier, FARE_CONFIG.MINIMUM_FARE);

    return {
      currency: "USD",
      baseFare: round2(baseFare),
      distanceFare: round2(distanceFare),
      timeFare: round2(timeFare),
      surgeMultiplier: round2(surgeMultiplier),
      total: round2(total),
      distanceMeters: input.distanceMeters,
      durationSeconds: input.durationSeconds,
      rideType: input.rideType,
    };
  }

  private resolveSurgeMultiplier(): number {
    // Kept deterministic for now; can be replaced with demand-based surge rules.
    return 1;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export const pricingService = new PricingService();

