import { rideConfig } from "../core/config";
import { platformStore } from "../platform/store";

export class RatingsService {
  submitRating(input: { tripId: string; riderId: number; driverId: string; score: number; feedback?: string }): {
    driverRating: number;
    totalRatings: number;
  } {
    const existing = platformStore.getRatingForTrip(input.tripId);
    if (existing) {
      throw new Error("Trip already rated");
    }

    platformStore.createRating({
      tripId: input.tripId,
      riderId: input.riderId,
      driverId: input.driverId,
      score: input.score,
      feedback: input.feedback ?? null,
    });

    const ratings = platformStore.listDriverRatings(input.driverId).slice(0, rideConfig.ratingRollingWindow);
    const weighted = this.computeWeightedAverage(ratings.map((entry) => entry.score));

    const profile = platformStore.getDriverById(input.driverId);
    if (profile) {
      platformStore.upsertDriverProfile({
        ...profile,
        rating: weighted,
      });
    }

    return {
      driverRating: weighted,
      totalRatings: ratings.length,
    };
  }

  private computeWeightedAverage(scores: number[]): number {
    if (scores.length === 0) return 5;
    let totalWeight = 0;
    let weightedSum = 0;
    for (let i = 0; i < scores.length; i += 1) {
      const weight = scores.length - i;
      totalWeight += weight;
      weightedSum += scores[i] * weight;
    }
    return Math.round((weightedSum / totalWeight) * 100) / 100;
  }
}

export const ratingsService = new RatingsService();

