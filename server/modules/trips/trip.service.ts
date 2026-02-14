import type {
  CreateTripRequest,
  DriverStatusRequest,
  TripRecord,
  TripState,
  UserRole,
} from "../../../shared/ride-hailing";
import { assertTransition, isTerminalTripState } from "./fsm";
import { createId, createNumericPin, hashPin, constantTimeEqual } from "../core/crypto";
import { locationStreamingService } from "../location/location.service";
import { logger } from "../observability/logger";
import { incrementMetric } from "../observability/metrics";
import { paymentService } from "../payments/payment.service";
import { platformStore } from "../platform/store";
import { pricingService } from "../pricing/pricing.service";
import { ratingsService } from "../ratings/ratings.service";
import { rideConfig } from "../core/config";
import { DispatchService } from "../dispatch/dispatch.service";

type TransitionActor = {
  actorId: string;
  actorRole: UserRole;
  reason?: string;
  meta?: Record<string, unknown>;
};

type AuthUser = {
  id: number;
  role: UserRole;
};

type DriverProfileInput = {
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  plateNumber: string;
};

class TripService {
  private readonly dispatch: DispatchService;

  constructor() {
    this.dispatch = new DispatchService({
      onDriverAssigned: async (tripId, driverId) => {
        platformStore.updateTrip(tripId, { driverId });
        await this.transitionTrip(tripId, "DRIVER_ASSIGNED", {
          actorId: driverId,
          actorRole: "driver",
          reason: "Driver accepted dispatch offer",
        });
        platformStore.setDriverStatus(driverId, { activeTripId: tripId });
      },
      onNoDriverFound: async (tripId) => {
        await this.transitionTrip(tripId, "NO_DRIVER_FOUND", {
          actorId: "dispatch",
          actorRole: "admin",
          reason: "No eligible driver found in dispatch radius",
        });
      },
    });

    // Dev bootstrap: ensures company-registered demo driver can go online
    // without requiring an admin registration call.
    if (!platformStore.getDriverByUserId(2001001)) {
      const demoDriverId = "driver_demo_2001001";
      platformStore.upsertDriverProfile({
        driverId: demoDriverId,
        userId: 2001001,
        verified: true,
        rating: 4.8,
        totalTrips: 156,
        vehicle: {
          make: "Toyota",
          model: "Prius",
          color: "Silver",
          plateNumber: "KAA111A",
        },
      });
      platformStore.setDriverStatus(demoDriverId, {
        isOnline: false,
        activeTripId: null,
      });
    }
  }

  estimateFare(input: {
    pickup: { lat: number; lng: number };
    dropoff: { lat: number; lng: number };
    distanceMeters: number;
    durationSeconds: number;
    rideType: "standard" | "premium";
  }) {
    const fare = pricingService.estimateFare({
      pickup: input.pickup,
      dropoff: input.dropoff,
      distanceMeters: input.distanceMeters,
      durationSeconds: input.durationSeconds,
      rideType: input.rideType,
    });

    return {
      fare,
      etaSeconds: input.durationSeconds,
      distanceMeters: input.distanceMeters,
    };
  }

  registerDriverByAdmin(
    adminUser: AuthUser,
    targetUserId: number,
    input: DriverProfileInput & { verified?: boolean },
  ) {
    this.assertRole(adminUser, ["admin"]);
    const existing = platformStore.getDriverByUserId(targetUserId);
    const driverId = existing?.driverId ?? createId("driver");
    const next = platformStore.upsertDriverProfile({
      driverId,
      userId: targetUserId,
      verified: input.verified ?? existing?.verified ?? false,
      rating: existing?.rating ?? 5,
      totalTrips: existing?.totalTrips ?? 0,
      vehicle: {
        make: input.vehicleMake,
        model: input.vehicleModel,
        color: input.vehicleColor,
        plateNumber: input.plateNumber,
      },
    });
    platformStore.setDriverStatus(driverId, {
      isOnline: false,
      activeTripId: null,
    });
    return next;
  }

  verifyDriver(driverId: string, verified: boolean) {
    const profile = platformStore.getDriverById(driverId);
    if (!profile) {
      throw new Error("Driver not found");
    }
    return platformStore.upsertDriverProfile({
      ...profile,
      verified,
    });
  }

  setDriverStatus(user: AuthUser, payload: DriverStatusRequest) {
    this.assertRole(user, ["driver", "admin"]);
    const profile = this.getRequiredDriverProfile(user.id);
    if (payload.isOnline && !profile.verified) {
      throw new Error("Driver must be verified before going online");
    }
    return platformStore.setDriverStatus(profile.driverId, {
      isOnline: payload.isOnline,
      lat: payload.lat ?? null,
      lng: payload.lng ?? null,
      lastSeenAt: new Date().toISOString(),
    });
  }

  async createTrip(user: AuthUser, input: CreateTripRequest): Promise<TripRecord> {
    this.assertRole(user, ["rider", "admin"]);
    const fare = pricingService.estimateFare(input);
    const now = new Date().toISOString();
    const trip: TripRecord = {
      id: createId("trip"),
      riderId: user.id,
      driverId: null,
      pickup: {
        lat: input.pickup.lat,
        lng: input.pickup.lng,
        address: input.pickupAddress,
      },
      dropoff: {
        lat: input.dropoff.lat,
        lng: input.dropoff.lng,
        address: input.dropoffAddress,
      },
      state: "CREATED",
      paymentMethod: input.paymentMethod,
      fare,
      createdAt: now,
      updatedAt: now,
      matchedAt: null,
      startedAt: null,
      completedAt: null,
      cancelledAt: null,
      cancelFee: 0,
      pinRequired: rideConfig.enableTripStartPin,
      pinExpiresAt: null,
      pinAttempts: 0,
    };

    platformStore.createTrip(trip);
    platformStore.appendTripAudit(trip.id, null, trip.state, String(user.id), user.role, "Trip created");
    locationStreamingService.publishTripUpdated(trip);

    const matchingTrip = await this.transitionTrip(trip.id, "MATCHING", {
      actorId: String(user.id),
      actorRole: user.role,
      reason: "Trip queued for dispatch",
    });

    void this.dispatch.startMatching(trip.id);
    incrementMetric("trip.created");
    return matchingTrip;
  }

  getTrip(user: AuthUser, tripId: string) {
    const trip = this.getRequiredTrip(tripId);
    this.assertTripAccess(user, trip);
    const driver = trip.driverId ? platformStore.getDriverById(trip.driverId) : null;
    const driverStatus = trip.driverId ? platformStore.getDriverStatus(trip.driverId) : null;
    const events = platformStore.listTripEvents(tripId);

    const pin = platformStore.getTripStartPin(tripId);
    const startPin =
      user.role === "rider" && trip.riderId === user.id && pin && new Date(pin.expiresAt).getTime() > Date.now()
        ? pin.plaintextPin
        : null;

    return {
      ...trip,
      driver: driver
        ? {
            driverId: driver.driverId,
            rating: driver.rating,
            totalTrips: driver.totalTrips,
            vehicle: driver.vehicle,
            location:
              driverStatus?.lat != null && driverStatus.lng != null
                ? { lat: driverStatus.lat, lng: driverStatus.lng }
                : null,
          }
        : null,
      startPin,
      events,
    };
  }

  listDriverRequests(user: AuthUser) {
    this.assertRole(user, ["driver", "admin"]);
    const profile = this.getRequiredDriverProfile(user.id);
    return this.dispatch.listDriverPendingOffers(profile.driverId);
  }

  async respondDriverRequest(user: AuthUser, offerId: string, accept: boolean) {
    this.assertRole(user, ["driver", "admin"]);
    const profile = this.getRequiredDriverProfile(user.id);
    return this.dispatch.respondToOffer(offerId, profile.driverId, accept);
  }

  async driverArrived(user: AuthUser, tripId: string) {
    this.assertRole(user, ["driver", "admin"]);
    const profile = this.getRequiredDriverProfile(user.id);
    const trip = this.getRequiredTrip(tripId);
    if (trip.driverId !== profile.driverId) {
      throw new Error("Trip is not assigned to this driver");
    }

    await this.transitionTrip(tripId, "DRIVER_ARRIVING", {
      actorId: profile.driverId,
      actorRole: "driver",
      reason: "Driver arrived at pickup",
    });

    if (rideConfig.enableTripStartPin) {
      const plaintextPin = createNumericPin(4);
      platformStore.saveTripStartPin({
        tripId,
        hash: hashPin(plaintextPin),
        plaintextPin,
        expiresAt: new Date(Date.now() + rideConfig.tripStartPinTtlMs).toISOString(),
        attempts: 0,
      });

      await this.transitionTrip(tripId, "PIN_VERIFICATION", {
        actorId: profile.driverId,
        actorRole: "driver",
        reason: "Waiting for trip start PIN verification",
      });
    }

    return this.getTrip(user, tripId);
  }

  async startTrip(user: AuthUser, tripId: string, pin?: string) {
    this.assertRole(user, ["driver", "admin"]);
    const profile = this.getRequiredDriverProfile(user.id);
    const trip = this.getRequiredTrip(tripId);
    if (trip.driverId !== profile.driverId) {
      throw new Error("Trip is not assigned to this driver");
    }

    if (trip.state === "PIN_VERIFICATION") {
      const pinRecord = platformStore.getTripStartPin(tripId);
      if (!pinRecord) {
        throw new Error("PIN session not found");
      }
      if (new Date(pinRecord.expiresAt).getTime() < Date.now()) {
        platformStore.deleteTripStartPin(tripId);
        throw new Error("PIN expired");
      }
      if (!pin) {
        throw new Error("PIN is required to start this trip");
      }

      const nextAttempts = pinRecord.attempts + 1;
      if (nextAttempts > rideConfig.tripStartPinMaxAttempts) {
        platformStore.deleteTripStartPin(tripId);
        throw new Error("PIN verification blocked due to too many attempts");
      }

      const providedHash = hashPin(pin);
      if (!constantTimeEqual(providedHash, pinRecord.hash)) {
        platformStore.saveTripStartPin({
          ...pinRecord,
          attempts: nextAttempts,
        });
        incrementMetric("trip.pin.failed");
        throw new Error("Invalid PIN");
      }

      platformStore.deleteTripStartPin(tripId);
      incrementMetric("trip.pin.success");
    } else if (trip.state !== "DRIVER_ARRIVING") {
      throw new Error(`Cannot start trip in state ${trip.state}`);
    }

    const startedTrip = await this.transitionTrip(tripId, "IN_PROGRESS", {
      actorId: profile.driverId,
      actorRole: "driver",
      reason: "Trip started by driver",
    });
    return startedTrip;
  }

  async completeTrip(user: AuthUser, tripId: string) {
    this.assertRole(user, ["driver", "admin"]);
    const profile = this.getRequiredDriverProfile(user.id);
    const trip = this.getRequiredTrip(tripId);
    if (trip.driverId !== profile.driverId) {
      throw new Error("Trip is not assigned to this driver");
    }

    const completedTrip = await this.transitionTrip(tripId, "COMPLETED", {
      actorId: profile.driverId,
      actorRole: "driver",
      reason: "Trip completed by driver",
    });

    platformStore.setDriverStatus(profile.driverId, { activeTripId: null });
    platformStore.upsertDriverProfile({
      ...profile,
      totalTrips: profile.totalTrips + 1,
    });

    const payment = await paymentService.capture(completedTrip.paymentMethod, {
      tripId: completedTrip.id,
      riderId: completedTrip.riderId,
      driverId: profile.driverId,
      amount: completedTrip.fare.total,
      currency: completedTrip.fare.currency,
    });

    incrementMetric("trip.completed");
    return {
      trip: completedTrip,
      payment,
    };
  }

  async cancelTrip(user: AuthUser, tripId: string, reason: string) {
    const trip = this.getRequiredTrip(tripId);
    this.assertTripAccess(user, trip);
    if (isTerminalTripState(trip.state)) {
      throw new Error(`Trip already finished in state ${trip.state}`);
    }

    const cancelledState: TripState = user.role === "driver" ? "CANCELLED_BY_DRIVER" : "CANCELLED_BY_PASSENGER";
    const cancelledTrip = await this.transitionTrip(tripId, cancelledState, {
      actorId: String(user.id),
      actorRole: user.role,
      reason,
    });

    if (trip.driverId) {
      platformStore.setDriverStatus(trip.driverId, { activeTripId: null });
    }

    const cancelFee = trip.driverId ? rideConfig.cancelFeeAfterAssign : rideConfig.cancelFeeBeforeAssign;
    return platformStore.updateTrip(cancelledTrip.id, {
      cancelFee,
    });
  }

  submitTripRating(user: AuthUser, tripId: string, score: number, feedback?: string) {
    this.assertRole(user, ["rider", "admin"]);
    const trip = this.getRequiredTrip(tripId);
    if (trip.riderId !== user.id && user.role !== "admin") {
      throw new Error("Cannot rate a trip you did not take");
    }
    if (trip.state !== "COMPLETED") {
      throw new Error("Trip must be completed before rating");
    }
    if (!trip.driverId) {
      throw new Error("Trip has no assigned driver");
    }

    const rating = ratingsService.submitRating({
      tripId,
      riderId: user.id,
      driverId: trip.driverId,
      score,
      feedback,
    });

    platformStore.appendTripAudit(
      trip.id,
      trip.state,
      trip.state,
      String(user.id),
      user.role,
      "Trip rated",
      { score },
    );

    return rating;
  }

  updateDriverLocation(
    user: AuthUser,
    payload: { lat: number; lng: number; heading?: number; speed?: number; tripId?: string },
  ) {
    this.assertRole(user, ["driver", "admin"]);
    const profile = this.getRequiredDriverProfile(user.id);
    const status = platformStore.setDriverStatus(profile.driverId, {
      lat: payload.lat,
      lng: payload.lng,
      lastSeenAt: new Date().toISOString(),
    });

    const tripId = payload.tripId ?? status.activeTripId;
    if (tripId) {
      platformStore.createTripLocation({
        tripId,
        userId: String(user.id),
        role: "driver",
        lat: payload.lat,
        lng: payload.lng,
        heading: payload.heading ?? null,
        speed: payload.speed ?? null,
      });
      locationStreamingService.publishDriverLocation({
        tripId,
        driverId: profile.driverId,
        lat: payload.lat,
        lng: payload.lng,
        heading: payload.heading ?? null,
        speed: payload.speed ?? null,
        timestamp: new Date().toISOString(),
      });
    }

    return status;
  }

  getDriverDashboard(user: AuthUser) {
    this.assertRole(user, ["driver", "admin"]);
    const profile = this.getRequiredDriverProfile(user.id);
    return {
      profile,
      status: platformStore.getDriverStatus(profile.driverId),
      pendingRequests: this.dispatch.listDriverPendingOffers(profile.driverId),
      activeTrips: platformStore.listTripsForDriver(profile.driverId).filter((trip) => !isTerminalTripState(trip.state)),
      recentTrips: platformStore.listTripsForDriver(profile.driverId).slice(0, 20),
    };
  }

  private async transitionTrip(tripId: string, toState: TripState, actor: TransitionActor): Promise<TripRecord> {
    return platformStore.withLock(`trip:${tripId}`, async () => {
      const current = this.getRequiredTrip(tripId);
      assertTransition(current.state, toState);

      const now = new Date().toISOString();
      const patch: Partial<TripRecord> = {
        state: toState,
      };
      if (toState === "DRIVER_ASSIGNED") patch.matchedAt = now;
      if (toState === "IN_PROGRESS") patch.startedAt = now;
      if (toState === "COMPLETED") patch.completedAt = now;
      if (toState === "CANCELLED_BY_DRIVER" || toState === "CANCELLED_BY_PASSENGER") {
        patch.cancelledAt = now;
      }

      const updated = platformStore.updateTrip(tripId, patch);
      platformStore.appendTripAudit(
        tripId,
        current.state,
        updated.state,
        actor.actorId,
        actor.actorRole,
        actor.reason,
        actor.meta,
      );

      locationStreamingService.publishTripUpdated(updated);
      logger.info("trip.state.transition", {
        tripId,
        fromState: current.state,
        toState: toState,
        actorId: actor.actorId,
        actorRole: actor.actorRole,
      });

      return updated;
    });
  }

  private getRequiredTrip(tripId: string): TripRecord {
    const trip = platformStore.getTripById(tripId);
    if (!trip) {
      throw new Error("Trip not found");
    }
    return trip;
  }

  private getRequiredDriverProfile(userId: number) {
    const profile = platformStore.getDriverByUserId(userId);
    if (!profile) {
      throw new Error("Driver profile not found. Complete driver onboarding first.");
    }
    return profile;
  }

  private assertRole(user: AuthUser, roles: UserRole[]): void {
    if (!roles.includes(user.role)) {
      throw new Error(`Role ${user.role} cannot perform this operation`);
    }
  }

  private assertTripAccess(user: AuthUser, trip: TripRecord): void {
    if (user.role === "admin") return;
    if (user.role === "rider" && trip.riderId === user.id) return;
    if (user.role === "driver") {
      const profile = platformStore.getDriverByUserId(user.id);
      if (profile && trip.driverId === profile.driverId) return;
    }
    throw new Error("Access denied for trip");
  }
}

export const tripService = new TripService();
