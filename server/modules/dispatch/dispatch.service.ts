import { rideConfig } from "../core/config";
import { createId } from "../core/crypto";
import { locationStreamingService } from "../location/location.service";
import { incrementMetric } from "../observability/metrics";
import { logger } from "../observability/logger";
import { platformStore } from "../platform/store";
import type { DriverDispatchOffer } from "../platform/types";
import { haversineKm } from "./geo";

type DispatchCallbacks = {
  onDriverAssigned: (tripId: string, driverId: string) => Promise<void>;
  onNoDriverFound: (tripId: string) => Promise<void>;
};

export class DispatchService {
  private readonly callbacks: DispatchCallbacks;
  private readonly offerTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(callbacks: DispatchCallbacks) {
    this.callbacks = callbacks;
  }

  async startMatching(tripId: string): Promise<void> {
    await platformStore.withLock(`dispatch:${tripId}`, async () => {
      const trip = platformStore.getTripById(tripId);
      if (!trip || trip.state !== "MATCHING") return;

      const existingAccepted = platformStore
        .listDispatchOffersForTrip(tripId)
        .find((offer) => offer.status === "ACCEPTED");
      if (existingAccepted) return;

      const nextCandidate = this.findNextCandidate(tripId, trip.pickup.lat, trip.pickup.lng);
      if (!nextCandidate) {
        await this.callbacks.onNoDriverFound(tripId);
        incrementMetric("dispatch.no_driver_found");
        return;
      }

      const now = new Date();
      const offer: DriverDispatchOffer = {
        id: createId("offer"),
        tripId,
        driverId: nextCandidate.driverId,
        status: "PENDING",
        distanceKm: nextCandidate.distanceKm,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + rideConfig.offerTimeoutMs).toISOString(),
        respondedAt: null,
      };

      platformStore.createDispatchOffer(offer);
      locationStreamingService.publishDriverOffer(offer);
      incrementMetric("dispatch.offer.created");
      logger.info("dispatch.offer.created", {
        tripId,
        driverId: offer.driverId,
        distanceKm: offer.distanceKm,
      });

      const timeout = setTimeout(() => {
        void this.expireOffer(offer.id);
      }, rideConfig.offerTimeoutMs);
      this.offerTimers.set(offer.id, timeout);
    });
  }

  async expireOffer(offerId: string): Promise<void> {
    const offer = platformStore.getDispatchOffer(offerId);
    if (!offer) return;

    await platformStore.withLock(`dispatch:${offer.tripId}`, async () => {
      const currentOffer = platformStore.getDispatchOffer(offerId);
      if (!currentOffer || currentOffer.status !== "PENDING") return;

      platformStore.updateDispatchOffer(offerId, {
        status: "EXPIRED",
        respondedAt: new Date().toISOString(),
      });

      incrementMetric("dispatch.offer.expired");
      this.clearOfferTimer(offerId);
      logger.info("dispatch.offer.expired", { offerId, tripId: currentOffer.tripId });

      await this.startMatching(currentOffer.tripId);
    });
  }

  async respondToOffer(offerId: string, driverId: string, accept: boolean): Promise<DriverDispatchOffer> {
    const offer = platformStore.getDispatchOffer(offerId);
    if (!offer) {
      throw new Error("Offer not found");
    }
    if (offer.driverId !== driverId) {
      throw new Error("Offer does not belong to driver");
    }

    return platformStore.withLock(`dispatch:${offer.tripId}`, async () => {
      const current = platformStore.getDispatchOffer(offerId);
      if (!current) throw new Error("Offer not found");
      if (current.status !== "PENDING") {
        throw new Error(`Offer already ${current.status}`);
      }

      const status = accept ? "ACCEPTED" : "DECLINED";
      const updated = platformStore.updateDispatchOffer(offerId, {
        status,
        respondedAt: new Date().toISOString(),
      });
      this.clearOfferTimer(offerId);

      if (accept) {
        incrementMetric("dispatch.offer.accepted");
        await this.callbacks.onDriverAssigned(current.tripId, current.driverId);
      } else {
        incrementMetric("dispatch.offer.declined");
        await this.startMatching(current.tripId);
      }

      return updated;
    });
  }

  listDriverPendingOffers(driverId: string): DriverDispatchOffer[] {
    const now = Date.now();
    return platformStore
      .listDispatchOffersForDriver(driverId)
      .filter((offer) => offer.status === "PENDING" && new Date(offer.expiresAt).getTime() > now);
  }

  private clearOfferTimer(offerId: string): void {
    const timeout = this.offerTimers.get(offerId);
    if (timeout) {
      clearTimeout(timeout);
      this.offerTimers.delete(offerId);
    }
  }

  private findNextCandidate(
    tripId: string,
    pickupLat: number,
    pickupLng: number,
  ): { driverId: string; distanceKm: number } | null {
    const offeredDriverIds = new Set(platformStore.listDispatchOffersForTrip(tripId).map((offer) => offer.driverId));

    const eligible = platformStore
      .listDrivers()
      .filter((driver) => driver.verified)
      .map((driver) => {
        const status = platformStore.getDriverStatus(driver.driverId);
        if (!status || !status.isOnline || status.activeTripId) return null;
        if (status.lat == null || status.lng == null) return null;

        const distanceKm = haversineKm(pickupLat, pickupLng, status.lat, status.lng);
        if (distanceKm > rideConfig.dispatchRadiusKm) return null;
        if (offeredDriverIds.has(driver.driverId)) return null;

        return {
          driverId: driver.driverId,
          distanceKm,
        };
      })
      .filter((candidate): candidate is { driverId: string; distanceKm: number } => !!candidate)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, rideConfig.maxDriverCandidates);

    return eligible[0] ?? null;
  }
}
